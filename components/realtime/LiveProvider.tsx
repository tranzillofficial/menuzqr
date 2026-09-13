"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  BROADCAST_EVENT,
  restaurantTopic,
  shouldAlert,
  type LiveEvent,
  type LiveEventKind,
} from "@/lib/events";
import type { MemberRole } from "@/lib/constants";

export type LiveStatus = "connecting" | "live" | "offline";

type LiveValue = {
  events: LiveEvent[];
  status: LiveStatus;
  muted: boolean;
  setMuted: (value: boolean) => void;
  permission: NotificationPermission | "unsupported";
  requestPermission: () => Promise<void>;
  dismiss: (id: string) => void;
  clear: () => void;
  /** Plays the alert once — used to preview the sound from settings. */
  test: () => void;
};

const LiveContext = createContext<LiveValue | null>(null);

const MAX_EVENTS = 30;
const SOUND_SRC = "/notification-sound.mp3";

export function useLive(): LiveValue {
  const value = useContext(LiveContext);
  if (value) return value;
  return {
    events: [],
    status: "offline",
    muted: true,
    setMuted: () => {},
    permission: "unsupported",
    requestPermission: async () => {},
    dismiss: () => {},
    clear: () => {},
    test: () => {},
  };
}

export function LiveProvider({
  restaurantId,
  role,
  soundEnabled,
  children,
}: {
  restaurantId: string;
  role: MemberRole;
  soundEnabled: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [muted, setMutedState] = useState(!soundEnabled);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported"
  );

  const mutedRef = useRef(!soundEnabled);
  const roleRef = useRef<MemberRole>(role);
  const seenRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  roleRef.current = role;

  const setMuted = useCallback((value: boolean) => {
    mutedRef.current = value;
    setMutedState(value);
    try {
      window.localStorage.setItem("mz_muted", value ? "1" : "0");
    } catch {
      // Private mode — the in-memory value still applies for this session.
    }
  }, []);

  // ------------------------------------------------------------ sound setup
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("mz_muted");
      if (stored === "1" || stored === "0") {
        const value = stored === "1";
        mutedRef.current = value;
        setMutedState(value);
      }
    } catch {
      // ignore
    }

    const audio = new Audio(SOUND_SRC);
    audio.preload = "auto";
    audio.volume = 1;
    audioRef.current = audio;

    // Browsers refuse to play audio until the user has interacted with the
    // page. The first tap anywhere unlocks the element silently, so the very
    // first real order already makes a sound.
    const unlock = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      const previous = audio.volume;
      audio.volume = 0;
      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = previous;
        })
        .catch(() => {
          audio.volume = previous;
        });
    };

    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true });

    if (typeof Notification !== "undefined") setPermission(Notification.permission);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const chime = useCallback(() => {
    if (mutedRef.current) return;

    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      const played = audio.play();
      if (played) played.catch(() => fallbackChime());
    } else {
      fallbackChime();
    }

    try {
      navigator.vibrate?.([180, 90, 180]);
    } catch {
      // Vibration is unsupported on desktop and on iOS; never a failure.
    }
  }, []);

  const test = useCallback(() => {
    unlockedRef.current = true;
    const wasMuted = mutedRef.current;
    mutedRef.current = false;
    chime();
    mutedRef.current = wasMuted;
  }, [chime]);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      // Some browsers reject the promise in insecure contexts.
    }
  }, []);

  // ------------------------------------------------------------- the stream
  useEffect(() => {
    const supabase = createClient();
    let live = true;
    let broadcastReady = false;
    let changesReady = false;

    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        if (live) router.refresh();
      }, 300);
    };

    const emit = (event: LiveEvent) => {
      if (!live || !event?.id || event.restaurantId !== restaurantId) return;
      if (seenRef.current.has(event.id)) return;

      seenRef.current.add(event.id);
      if (seenRef.current.size > 400) {
        seenRef.current = new Set([...seenRef.current].slice(-200));
      }

      setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
      scheduleRefresh();

      if (shouldAlert(event.kind as LiveEventKind, roleRef.current)) {
        chime();
        void showSystemNotification(event, roleRef.current);
      }
    };

    const syncStatus = () => {
      if (!live) return;
      setStatus(broadcastReady || changesReady ? "live" : "connecting");
    };

    let channels: Array<ReturnType<typeof supabase.channel>> = [];

    const connect = async () => {
      // Realtime authenticates separately from the REST client. Without this
      // the socket joins as an anonymous visitor, every row-level policy
      // rejects it, and the dashboard sits there silently receiving nothing.
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          await Promise.resolve(supabase.realtime.setAuth(session.access_token));
        }
      } catch {
        // Fall through — postgres_changes may still work for public tables.
      }
      if (!live) return;

      const suffix = Math.random().toString(36).slice(2);

      // 1. Broadcast: sent explicitly by our server actions. Independent of
      //    the publication and of change-data-capture RLS evaluation.
      // `private` was added to the channel options type in a later release of
      // supabase-js than this project's floor, so the cast keeps both happy.
      const privateConfig = { config: { private: true } } as unknown as Parameters<
        typeof supabase.channel
      >[1];

      const broadcast = supabase
        .channel(restaurantTopic(restaurantId), privateConfig)
        .on("broadcast", { event: BROADCAST_EVENT }, (message) => {
          emit(message.payload as LiveEvent);
        })
        .subscribe((state) => {
          broadcastReady = state === "SUBSCRIBED";
          syncStatus();
        });

      // 2. postgres_changes: the belt to the broadcast's braces. Both paths
      //    produce the same deterministic event id, so nothing shows twice.
      const changes = supabase
        .channel(`orders-${restaurantId}-${suffix}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "orders",
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          (payload) => {
            const row = payload.new as {
              id: string;
              order_number: number;
              total: number;
              currency: string;
              created_at: string;
            };
            emit({
              id: `order.new:${row.id}`,
              kind: "order.new",
              restaurantId,
              at: row.created_at ?? new Date().toISOString(),
              orderId: row.id,
              orderNumber: row.order_number,
              total: row.total,
              currency: row.currency,
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          (payload) => {
            const row = payload.new as { id: string; order_number: number; status: string };
            const previous = payload.old as { status?: string } | null;
            if (row.status === previous?.status) return;
            if (row.status === "ready") {
              emit({
                id: `order.ready:${row.id}`,
                kind: "order.ready",
                restaurantId,
                at: new Date().toISOString(),
                orderId: row.id,
                orderNumber: row.order_number,
              });
            } else {
              scheduleRefresh();
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "waiter_requests",
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          async (payload) => {
            const row = payload.new as {
              id: string;
              table_id: string | null;
              origin?: string;
              created_at: string;
            };
            let label: string | null = null;
            if (row.table_id) {
              const { data } = await supabase
                .from("restaurant_tables")
                .select("label")
                .eq("id", row.table_id)
                .maybeSingle();
              label = data?.label ?? null;
            }
            emit({
              id: `waiter:${row.id}`,
              kind: row.origin === "staff" ? "waiter.pickup" : "waiter.call",
              restaurantId,
              at: row.created_at ?? new Date().toISOString(),
              tableLabel: label,
            });
          }
        )
        .subscribe((state) => {
          changesReady = state === "SUBSCRIBED";
          syncStatus();
        });

      channels = [broadcast, changes];
    };

    void connect();

    // Phones suspend websockets when the screen locks. Coming back to the tab
    // re-reads the data, so nothing that happened while away is missed.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
        if (!broadcastReady && !changesReady) setStatus("connecting");
      }
    };
    const onOffline = () => setStatus("offline");
    const onOnline = () => scheduleRefresh();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      live = false;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [restaurantId, router, chime]);

  // A notification tapped from the service worker asks the page to make a
  // sound too, so an open-but-backgrounded tab behaves like the phone does.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "menuzqr-push") chime();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [chime]);

  const value = useMemo<LiveValue>(
    () => ({
      events,
      status,
      muted,
      setMuted,
      permission,
      requestPermission,
      dismiss: (id: string) => setEvents((prev) => prev.filter((e) => e.id !== id)),
      clear: () => setEvents([]),
      test,
    }),
    [events, status, muted, setMuted, permission, requestPermission, test]
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

async function showSystemNotification(event: LiveEvent, role: MemberRole) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  // Built lazily so the provider stays free of dictionary imports at module
  // scope; the strings themselves come from the page's own translator.
  const { describeEvent, eventLink } = await import("@/lib/events");
  const { createTranslator, isLocale } = await import("@/lib/i18n");
  const locale = document.documentElement.lang;
  const t = createTranslator(isLocale(locale) ? locale : "en");
  const { title, body, emoji } = describeEvent(event, t);

  const options: NotificationOptions = {
    body,
    tag: event.id,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    data: { url: eventLink(event.kind, role) },
  };

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(`${emoji} ${title}`, options);
        return;
      }
    }
    new Notification(`${emoji} ${title}`, options);
  } catch {
    // Android requires a service worker for notifications; nothing to do.
  }
}

function fallbackChime() {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const now = ctx.currentTime;
    [1318, 1975].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.16;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.42);
    });
  } catch {
    // Sound is a nice-to-have.
  }
}
