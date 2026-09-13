"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";
import { resolveWaiterRequestAction, updateOrderStatusAction } from "@/lib/actions/orders";
import { relativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Alert =
  | { kind: "order"; id: string; title: string; body: string; at: string }
  | { kind: "waiter"; id: string; title: string; body: string; at: string };

/**
 * Short two-tone chime, generated with the Web Audio API — no asset to ship.
 * Reads `mutedRef` at call time so toggling mute never changes this callback's
 * identity (which would otherwise resubscribe the realtime channel).
 */
function useChime(mutedRef: { current: boolean }) {
  const ctxRef = useRef<AudioContext | null>(null);

  return useCallback(() => {
    if (mutedRef.current) return;
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctxRef.current ??= new Ctor();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") void ctx.resume();

      const now = ctx.currentTime;
      [880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + i * 0.18;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.36);
      });
    } catch {
      // Audio is a nice-to-have; never break the dashboard over it.
    }
  }, [mutedRef]);
}

export function NotificationCenter({
  restaurantId,
  soundEnabled,
}: {
  restaurantId: string;
  soundEnabled: boolean;
}) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(!soundEnabled);
  const mutedRef = useRef(!soundEnabled);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const chime = useChime(mutedRef);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  const notify = useCallback(
    (title: string, body: string) => {
      chime();
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification(title, { body, tag: `${title}-${body}` });
        } catch {
          // Browsers on some platforms require a service worker; ignore.
        }
      }
    },
    [chime]
  );

  useEffect(() => {
    const supabase = createClient();
    let live = true;

    // A unique topic per mount. `supabase.channel(name)` hands back an existing
    // channel when the topic matches, and `removeChannel` resolves
    // asynchronously — so in React StrictMode the second mount would otherwise
    // get the already-subscribed channel from the first and throw
    // "cannot add postgres_changes callbacks after subscribe()".
    const channel = supabase
      .channel(`restaurant-${restaurantId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          if (!live) return;
          const row = payload.new as { id: string; order_number: number; total: number };
          const alert: Alert = {
            kind: "order",
            id: row.id,
            title: `New order #${row.order_number}`,
            body: "A table just sent an order.",
            at: new Date().toISOString(),
          };
          setAlerts((prev) => [alert, ...prev].slice(0, 25));
          notify(alert.title, alert.body);
          router.refresh();
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
          if (!live) return;
          const row = payload.new as { id: string; table_id: string };
          const { data } = await supabase
            .from("restaurant_tables")
            .select("label")
            .eq("id", row.table_id)
            .maybeSingle();
          if (!live) return;

          const label = data?.label ?? "A table";
          const alert: Alert = {
            kind: "waiter",
            id: row.id,
            title: `${label} needs a waiter`,
            body: "Tap to mark it as handled.",
            at: new Date().toISOString(),
          };
          setAlerts((prev) => [alert, ...prev].slice(0, 25));
          notify(`🔔 ${alert.title}`, alert.body);
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      live = false;
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, notify, router]);

  const unread = alerts.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? ` (${unread} new)` : ""}`}
        className={cn(
          "relative rounded-xl border border-ink-200 bg-white p-2 text-ink-600 transition-colors hover:bg-ink-50",
          unread > 0 && "animate-pulse-ring border-brand-300 text-brand-700"
        )}
      >
        <Icon.bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-semibold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="animate-slide-up absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">Live activity</p>
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className="text-xs text-ink-500 underline-offset-2 hover:underline"
              >
                {muted ? "Unmute sound" : "Mute sound"}
              </button>
            </div>

            {permission === "default" && (
              <button
                type="button"
                onClick={async () => setPermission(await Notification.requestPermission())}
                className="w-full border-b border-ink-100 bg-brand-50 px-4 py-2.5 text-left text-xs font-medium text-brand-800 hover:bg-brand-100"
              >
                Enable browser notifications →
              </button>
            )}

            <div className="max-h-80 overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink-500">
                  Nothing yet. New orders and waiter calls appear here instantly.
                </p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {alerts.map((alert) => (
                    <li key={`${alert.kind}-${alert.id}`} className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 text-base">
                          {alert.kind === "waiter" ? "🔔" : "🧾"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink-900">{alert.title}</p>
                          <p className="text-xs text-ink-500">
                            {alert.body} · {relativeTime(alert.at)}
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={async () => {
                                if (alert.kind === "waiter") {
                                  await resolveWaiterRequestAction(alert.id);
                                } else {
                                  await updateOrderStatusAction(alert.id, "accepted");
                                }
                                setAlerts((prev) =>
                                  prev.filter((a) => !(a.kind === alert.kind && a.id === alert.id))
                                );
                                router.refresh();
                              }}
                            >
                              {alert.kind === "waiter" ? "Mark as handled" : "Accept order"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {alerts.length > 0 && (
              <button
                type="button"
                onClick={() => setAlerts([])}
                className="w-full border-t border-ink-100 px-4 py-2.5 text-xs font-medium text-ink-500 hover:bg-ink-50"
              >
                Clear list
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
