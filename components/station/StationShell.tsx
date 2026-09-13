"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icons";
import { useT } from "@/components/i18n/I18nProvider";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { useLive } from "@/components/realtime/LiveProvider";
import { cn } from "@/lib/utils";
import type { MemberRole } from "@/lib/constants";

/**
 * The station is a phone-first screen: one column, large targets, no sidebar.
 * It is what a waiter or a cook actually holds during service.
 */
export function StationShell({
  children,
  restaurantName,
  displayName,
  role,
  isManager,
}: {
  children: ReactNode;
  restaurantName: string;
  displayName: string;
  role: MemberRole;
  isManager: boolean;
}) {
  const t = useT();
  const { status, muted, setMuted } = useLive();

  const roleLabel =
    role === "chef" ? t("staff.roleChef") : role === "waiter" ? t("staff.roleWaiter") : t("staff.roleManager");

  return (
    <div className="min-h-screen bg-ink-900 text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-600">
            {role === "chef" ? <Icon.chef className="size-5" /> : <Icon.waiter className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{displayName || roleLabel}</p>
            <p className="truncate text-xs text-white/50">
              {roleLabel} · {restaurantName}
            </p>
          </div>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
              status === "live"
                ? "bg-emerald-500/15 text-emerald-300"
                : status === "connecting"
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-red-500/15 text-red-300"
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                status === "live"
                  ? "animate-pulse bg-emerald-400"
                  : status === "connecting"
                    ? "bg-amber-400"
                    : "bg-red-400"
              )}
            />
            {status === "live"
              ? t("alerts.live")
              : status === "connecting"
                ? t("alerts.connecting")
                : t("alerts.offline")}
          </span>

          <button
            type="button"
            onClick={() => setMuted(!muted)}
            aria-label={muted ? t("dash.unmuteSound") : t("dash.muteSound")}
            className={cn(
              "rounded-xl p-2 transition-colors",
              muted ? "bg-white/5 text-white/40" : "bg-white/10 text-white"
            )}
          >
            <Icon.volume className="size-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5 pb-24">{children}</main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-ink-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
          <LocaleSwitch className="border-white/15 bg-white/5 text-white hover:bg-white/10" />
          <div className="flex items-center gap-2">
            {isManager && (
              <Link
                href="/dashboard"
                className="rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
              >
                {t("station.toDashboard")}
              </Link>
            )}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10"
              >
                <Icon.logout className="size-4.5" />
                {t("common.signOut")}
              </button>
            </form>
          </div>
        </div>
      </footer>
    </div>
  );
}
