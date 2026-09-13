"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icons";
import { initials } from "@/lib/utils";
import { useT } from "@/components/i18n/I18nProvider";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";

export function AccountMenu({
  email,
  restaurantName,
  isAdmin,
}: {
  email: string;
  restaurantName: string | null;
  isAdmin: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const label = restaurantName || email || "Account";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white p-1 pe-2 text-ink-700 transition-colors hover:bg-ink-50"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-600 text-xs font-semibold text-white">
          {initials(label) || "M"}
        </span>
        <span className="hidden max-w-32 truncate text-sm font-medium sm:block">{label}</span>
        <svg viewBox="0 0 20 20" className="size-4 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            className="animate-slide-up absolute end-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-xl"
          >
            <div className="border-b border-ink-100 px-4 py-3">
              <p className="truncate text-sm font-medium text-ink-900">
                {restaurantName ?? t("dash.setupCta")}
              </p>
              <p className="truncate text-xs text-ink-500" title={email}>
                {email}
              </p>
            </div>

            <div className="border-b border-ink-100 p-2">
              <LocaleSwitch className="w-full justify-center" />
            </div>

            <div className="p-1.5">
              <Link
                href="/dashboard/settings"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-700 transition-colors hover:bg-ink-100"
              >
                <Icon.settings className="size-4" />
                {t("common.settings")}
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-700 transition-colors hover:bg-ink-100"
                >
                  <Icon.shield className="size-4" />
                  {t("common.admin")}
                </Link>
              )}
            </div>

            <form action="/auth/signout" method="post" className="border-t border-ink-100 p-1.5">
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <Icon.logout className="size-4" />
                {t("common.signOut")}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
