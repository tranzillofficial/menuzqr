"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icons";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { useT } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n";
import { useDrawer } from "@/components/ui/useDrawer";
import { cn } from "@/lib/utils";

const NAV: Array<{
  href: string;
  label: TranslationKey;
  icon: (typeof Icon)[keyof typeof Icon];
  exact?: boolean;
}> = [
  { href: "/admin", label: "admin.restaurants", icon: Icon.store, exact: true },
  { href: "/admin/users", label: "admin.users", icon: Icon.users },
  { href: "/admin/catalog", label: "admin.catalog", icon: Icon.burger },
  { href: "/admin/library", label: "admin.imageLibrary", icon: Icon.image },
  { href: "/admin/coupons", label: "admin.coupons", icon: Icon.sparkles },
  { href: "/admin/qr-designs", label: "admin.qrDesigns", icon: Icon.qr },
  { href: "/admin/platform", label: "admin.platform", icon: Icon.settings },
];

/**
 * Admin chrome.
 *
 * The old header crammed six links, an email, a language switch and two
 * buttons onto one row — unusable on a phone. Now: a compact bar with a real
 * drawer under `lg`, and the full inline nav only where there is room for it.
 */
export function AdminShell({ children, email }: { children: ReactNode; email: string }) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useDrawer(open, close, pathname);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const current = NAV.find((item) => isActive(item.href, item.exact));

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-30 border-b border-ink-800 bg-ink-900 text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={t("admin.menu")}
            aria-expanded={open}
            aria-controls="mz-admin-drawer"
            className="-ms-1 rounded-lg p-2 text-white/80 hover:bg-white/10 lg:hidden"
          >
            <Icon.menu className="size-5" />
          </button>

          <Link href="/admin" className="flex min-w-0 items-center gap-2 font-semibold">
            <Icon.shield className="size-5 shrink-0" />
            <span className="truncate">
              <span className="lg:hidden">{current ? t(current.label) : "Admin"}</span>
              <span className="hidden lg:inline">MenuzQR Admin</span>
            </span>
          </Link>

          <nav className="hidden gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href, item.exact) ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors",
                  isActive(item.href, item.exact)
                    ? "bg-white/15 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                {t(item.label)}
              </Link>
            ))}
          </nav>

          <div className="ms-auto flex shrink-0 items-center gap-2">
            <LocaleSwitch tone="dark" className="hidden sm:inline-flex" />
            <span
              className="hidden max-w-40 truncate text-xs text-white/50 xl:block"
              title={email}
            >
              {email}
            </span>
            <Link
              href="/dashboard"
              className="hidden whitespace-nowrap rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 sm:block"
            >
              {t("nav.myDashboard")}
            </Link>
            <form action="/auth/signout" method="post" className="hidden sm:block">
              <button
                type="submit"
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon.logout className="size-4" />
                {t("common.signOut")}
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Drawer — phone and tablet */}
      {open && (
        <div
          id="mz-admin-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Admin navigation"
          className="fixed inset-0 z-40 lg:hidden"
        >
          <div
            className="absolute inset-0 bg-ink-900/50"
            onClick={close}
            aria-hidden="true"
          />
          <nav className="animate-slide-in absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col gap-1 overflow-y-auto bg-ink-900 p-3 text-white shadow-xl">
            <div className="flex items-center gap-2 px-2 pb-3 pt-1">
              <Icon.shield className="size-5" />
              <span className="font-semibold">MenuzQR Admin</span>
              <button
                type="button"
                onClick={close}
                aria-label={t("common.close")}
                className="ms-auto rounded-lg p-1.5 text-white/70 hover:bg-white/10"
              >
                <Icon.plus className="size-5 rotate-45" />
              </button>
            </div>

            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href, item.exact) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                  isActive(item.href, item.exact)
                    ? "bg-white/15 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="size-5 shrink-0" />
                {t(item.label)}
              </Link>
            ))}

            <div className="mt-auto space-y-2 border-t border-white/10 pt-3">
              <LocaleSwitch tone="dark" className="w-full justify-center" />
              <p className="truncate px-3 text-xs text-white/40" title={email}>
                {email}
              </p>
              <Link
                href="/dashboard"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10"
              >
                <Icon.home className="size-5 shrink-0" />
                {t("nav.myDashboard")}
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/10"
                >
                  <Icon.logout className="size-5 shrink-0" />
                  {t("common.signOut")}
                </button>
              </form>
            </div>
          </nav>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">{children}</main>
    </div>
  );
}
