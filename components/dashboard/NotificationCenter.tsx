"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";
import { resolveWaiterRequestAction, updateOrderStatusAction } from "@/lib/actions/orders";
import { relativeTime, cn } from "@/lib/utils";
import { useT } from "@/components/i18n/I18nProvider";
import { useLive } from "@/components/realtime/LiveProvider";
import { describeEvent } from "@/lib/events";

/**
 * The bell in the dashboard header. It renders whatever the shared live stream
 * has seen — the stream itself owns the connection, the sound and the browser
 * notification, so nothing here fires twice when two headers are mounted at
 * once (mobile bar + desktop bar).
 */
export function NotificationCenter() {
  const router = useRouter();
  const t = useT();
  const { events, status, muted, setMuted, permission, requestPermission, dismiss, clear } =
    useLive();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const unread = events.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("dash.liveActivity")}
        className={cn(
          "relative rounded-xl border border-ink-200 bg-white p-2 text-ink-600 transition-colors hover:bg-ink-50",
          unread > 0 && "animate-pulse-ring border-brand-300 text-brand-700"
        )}
      >
        <Icon.bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -end-1 -top-1 grid min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-semibold text-white">
            {unread}
          </span>
        )}
        <span
          aria-hidden="true"
          className={cn(
            "absolute -bottom-0.5 -start-0.5 size-2 rounded-full ring-2 ring-white",
            status === "live"
              ? "bg-emerald-500"
              : status === "connecting"
                ? "bg-amber-400"
                : "bg-red-500"
          )}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="animate-slide-up absolute end-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink-900">{t("dash.liveActivity")}</p>
                <p
                  className={cn(
                    "text-[11px] font-medium",
                    status === "live"
                      ? "text-emerald-600"
                      : status === "connecting"
                        ? "text-amber-600"
                        : "text-red-600"
                  )}
                >
                  {status === "live"
                    ? t("alerts.live")
                    : status === "connecting"
                      ? t("alerts.connecting")
                      : t("alerts.offline")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMuted(!muted)}
                className="text-xs text-ink-500 underline-offset-2 hover:underline"
              >
                {muted ? t("dash.unmuteSound") : t("dash.muteSound")}
              </button>
            </div>

            {permission === "default" && (
              <button
                type="button"
                onClick={requestPermission}
                className="w-full border-b border-ink-100 bg-brand-50 px-4 py-2.5 text-start text-xs font-medium text-brand-800 hover:bg-brand-100"
              >
                {t("dash.enableNotifications")}
              </button>
            )}

            <div className="max-h-80 overflow-y-auto">
              {events.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink-500">{t("dash.noActivity")}</p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {events.map((event) => {
                    const { title, body, emoji } = describeEvent(event, t);
                    const isWaiter =
                      event.kind === "waiter.call" || event.kind === "waiter.pickup";
                    const actionable = isWaiter || event.kind === "order.new";

                    return (
                      <li key={event.id} className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 text-base">{emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink-900">{title}</p>
                            <p className="text-xs text-ink-500">
                              {body} · {relativeTime(event.at)}
                            </p>
                            {actionable && (
                              <div className="mt-2 flex gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  loading={busy === event.id}
                                  onClick={async () => {
                                    setBusy(event.id);
                                    try {
                                      if (isWaiter) {
                                        const id = event.id.split(":")[1];
                                        if (id) await resolveWaiterRequestAction(id);
                                      } else if (event.orderId) {
                                        await updateOrderStatusAction(event.orderId, "accepted");
                                      }
                                      dismiss(event.id);
                                      router.refresh();
                                    } finally {
                                      setBusy(null);
                                    }
                                  }}
                                >
                                  {isWaiter ? t("dash.markHandled") : t("dash.acceptOrder")}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {events.length > 0 && (
              <button
                type="button"
                onClick={clear}
                className="w-full border-t border-ink-100 px-4 py-2.5 text-xs font-medium text-ink-500 hover:bg-ink-50"
              >
                {t("dash.clearList")}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
