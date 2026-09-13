"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "./NotificationCenter";
import { useT } from "@/components/i18n/I18nProvider";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import type { TranslationKey } from "@/lib/i18n";
import { AccountMenu } from "./AccountMenu";

const NAV: Array<{
  href: string;
  label: TranslationKey;
  icon: (typeof Icon)[keyof typeof Icon];
  exact?: boolean;
}> = [
  { href: "/dashboard", label: "nav.overview", icon: Icon.home, exact: true },
  { href: "/dashboard/restaurant", label: "nav.restaurant", icon: Icon.store },
  { href: "/dashboard/categories", label: "nav.categories", icon: Icon.grid },
  { href: "/dashboard/products", label: "nav.products", icon: Icon.burger },
  { href: "/dashboard/catalog", label: "nav.catalog", icon: Icon.sparkles },
  { href: "/dashboard/tables", label: "nav.tables", icon: Icon.table },
  { href: "/dashboard/qr-codes", label: "nav.qrCodes", icon: Icon.qr },
  { href: "/dashboard/orders", label: "nav.orders", icon: Icon.receipt },
  { href: "/dashboard/staff", label: "nav.staff", icon: Icon.users },
  { href: "/dashboard/design", label: "nav.design", icon: Icon.palette },
  { href: "/dashboard/settings", label: "nav.settings", icon: Icon.settings },
];

export function DashboardShell({
  children,
  restaurantName,
  restaurantId,
  isAdmin,
  userEmail,
}: {
  children: ReactNode;
  restaurantName: string | null;
  restaurantId: string | null;
  isAdmin: boolean;
  userEmail: string;
}) {
  const pathname = usePathname();
  const t = useT();
  const [open, setOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = isActive(item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-50 text-brand-700"
                : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
            )}
          >
            <item.icon className="size-4.5 shrink-0" />
            {t(item.label)}
          </Link>
        );
      })}

      {isAdmin && (
        <>
          <div className="my-2 border-t border-ink-100" />
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
          >
            <Icon.shield className="size-4.5 shrink-0" />
            {t("common.admin")}
          </Link>
        </>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-ink-200 bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation"
          aria-expanded={open}
          className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-100"
        >
          <Icon.menu className="size-5" />
        </button>
        <span className="truncate text-sm font-semibold text-ink-900">
          {restaurantName ?? "MenuzQR"}
        </span>
        <div className="ms-auto flex shrink-0 items-center gap-2">
          {restaurantId && <NotificationCenter />}
          <AccountMenu email={userEmail} restaurantName={restaurantName} isAdmin={isAdmin} />
        </div>
      </div>

      <div className="mx-auto flex max-w-[1400px]">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 start-0 z-40 w-64 shrink-0 border-e border-ink-200 bg-white p-4 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
          )}
        >
          <div className="flex h-full flex-col">
            <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2 pt-1">
              <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">
                <Icon.qr className="size-4.5" />
              </span>
              <span className="font-semibold text-ink-900">MenuzQR</span>
            </Link>

            {nav}

            <div className="mt-auto space-y-2 border-t border-ink-100 pt-3">
              <LocaleSwitch className="w-full justify-center" />
              <p className="truncate px-3 text-xs text-ink-400" title={userEmail}>
                {userEmail}
              </p>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <Icon.logout className="size-4.5" />
                  {t("common.signOut")}
                </button>
              </form>
            </div>
          </div>
        </aside>

        {open && (
          <div
            className="fixed inset-0 z-30 bg-ink-900/30 lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="hidden h-16 items-center justify-end gap-3 border-b border-ink-200 bg-white px-6 lg:flex">
            {restaurantId && <NotificationCenter />}
            <AccountMenu email={userEmail} restaurantName={restaurantName} isAdmin={isAdmin} />
          </div>
          <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
