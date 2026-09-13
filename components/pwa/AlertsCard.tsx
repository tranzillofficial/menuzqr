"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";
import { useT } from "@/components/i18n/I18nProvider";
import { useLive } from "@/components/realtime/LiveProvider";
import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
} from "@/lib/actions/push";
import { cn } from "@/lib/utils";

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/**
 * One card for everything that makes an alert reach a human: connection, sound,
 * notification permission, background push, and installing the site as an app.
 */
export function AlertsCard() {
  const t = useT();
  const { status, muted, setMuted, permission, requestPermission, test } = useLive();

  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true
    );
    setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setPushOn(false);
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) setPushOn(Boolean(existing));
      } catch {
        if (!cancelled) setPushOn(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pushSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    VAPID_KEY.length > 20;

  async function togglePush() {
    setBusy(true);
    setPushError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();

      if (existing) {
        await removePushSubscriptionAction(existing.endpoint);
        await existing.unsubscribe();
        setPushOn(false);
        return;
      }

      if (Notification.permission !== "granted") {
        const result = await Notification.requestPermission();
        if (result !== "granted") {
          setPushError(t("alerts.blockedHint"));
          return;
        }
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
      });

      const json = subscription.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };

      const saved = await savePushSubscriptionAction(
        {
          endpoint: json.endpoint ?? subscription.endpoint,
          keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
        },
        navigator.userAgent
      );

      if (!saved.ok) {
        await subscription.unsubscribe();
        setPushError(saved.message ?? t("alerts.pushFailed"));
        return;
      }
      setPushOn(true);
    } catch {
      setPushError(t("alerts.pushFailed"));
    } finally {
      setBusy(false);
    }
  }

  const statusTone =
    status === "live" ? "text-emerald-600" : status === "connecting" ? "text-amber-600" : "text-red-600";

  return (
    <Card>
      <CardHeader title={t("alerts.title")} description={t("alerts.sub")} />

      <div className="divide-y divide-ink-100">
        {/* Connection */}
        <Row
          icon={<Icon.wifi className="size-5" />}
          title={t("alerts.status")}
          description={t("alerts.liveHint")}
        >
          <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", statusTone)}>
            <span
              className={cn(
                "size-2 rounded-full",
                status === "live"
                  ? "animate-pulse bg-emerald-500"
                  : status === "connecting"
                    ? "bg-amber-500"
                    : "bg-red-500"
              )}
            />
            {status === "live"
              ? t("alerts.live")
              : status === "connecting"
                ? t("alerts.connecting")
                : t("alerts.offline")}
          </span>
        </Row>

        {/* Sound */}
        <Row
          icon={<Icon.volume className="size-5" />}
          title={t("alerts.sound")}
          description={muted ? t("alerts.soundOff") : t("alerts.soundOn")}
        >
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={test}>
              {t("alerts.test")}
            </Button>
            <Button
              size="sm"
              variant={muted ? "primary" : "secondary"}
              onClick={() => setMuted(!muted)}
            >
              {muted ? t("alerts.turnOn") : t("alerts.turnOff")}
            </Button>
          </div>
        </Row>

        {/* Permission */}
        <Row
          icon={<Icon.bell className="size-5" />}
          title={t("alerts.browser")}
          description={t("alerts.browserSub")}
        >
          {permission === "granted" ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <Icon.check className="size-4" />
              {t("alerts.enabled")}
            </span>
          ) : permission === "denied" ? (
            <span className="text-sm text-red-600">{t("alerts.blocked")}</span>
          ) : (
            <Button size="sm" onClick={requestPermission}>
              {t("alerts.enable")}
            </Button>
          )}
        </Row>

        {/* Background push */}
        <Row
          icon={<Icon.phone className="size-5" />}
          title={t("alerts.push")}
          description={pushSupported ? t("alerts.pushSub") : t("alerts.pushUnavailable")}
        >
          {pushSupported ? (
            <Button
              size="sm"
              variant={pushOn ? "secondary" : "primary"}
              loading={busy}
              onClick={togglePush}
            >
              {pushOn ? t("alerts.turnOff") : t("alerts.turnOn")}
            </Button>
          ) : null}
        </Row>

        {pushError && (
          <p className="bg-red-50 px-5 py-2.5 text-sm text-red-700">{pushError}</p>
        )}

        {/* Install */}
        <Row
          icon={<Icon.download className="size-5" />}
          title={t("alerts.install")}
          description={standalone ? t("alerts.installed") : t("alerts.installSub")}
        >
          {standalone ? (
            <Icon.check className="size-5 text-emerald-600" />
          ) : installEvent ? (
            <Button
              size="sm"
              onClick={async () => {
                await installEvent.prompt();
                setInstallEvent(null);
              }}
            >
              {t("alerts.installNow")}
            </Button>
          ) : isIos ? (
            <span className="max-w-[15rem] text-end text-xs text-ink-500">
              {t("alerts.iosHint")}
            </span>
          ) : (
            <span className="max-w-[15rem] text-end text-xs text-ink-500">
              {t("alerts.installHint")}
            </span>
          )}
        </Row>
      </div>
    </Card>
  );
}

function Row({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-ink-400">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-900">{title}</p>
          <p className="mt-0.5 text-xs text-ink-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * VAPID keys travel as base64url; PushManager wants raw bytes.
 *
 * Backed by an explicit ArrayBuffer rather than `new Uint8Array(length)`: the
 * latter is typed `Uint8Array<ArrayBufferLike>`, which no longer satisfies the
 * `BufferSource` that `applicationServerKey` expects.
 */
function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalised);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
