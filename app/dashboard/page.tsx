import Link from "next/link";
import type { Metadata } from "next";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMyRestaurant } from "@/lib/auth";
import { ActivationPanel, StatusBadge } from "@/components/dashboard/ActivationPanel";
import { PageHeader } from "@/components/dashboard/Shell";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";
import { absoluteUrl, formatMoney } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage() {
  const [restaurant, t] = await Promise.all([getMyRestaurant(), getT()]);

  if (!restaurant) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <Icon.store className="size-7" />
        </span>
        <h1 className="text-2xl font-semibold text-ink-900">{t("dash.setupTitle")}</h1>
        <p className="mt-2 text-sm text-ink-500">
          {t("dash.setupBody")}
        </p>
        <LinkButton href="/dashboard/restaurant" size="lg" className="mt-6">
          {t("dash.setupCta")}
        </LinkButton>
      </div>
    );
  }

  const supabase = await createServerSupabase();
  const [categories, products, tables, openOrders, pendingWaiters, recentOrders] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurant.id),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurant.id),
      supabase
        .from("restaurant_tables")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurant.id),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurant.id)
        .in("status", ["pending", "accepted", "preparing", "ready"]),
      supabase
        .from("waiter_requests")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurant.id)
        .eq("status", "pending"),
      supabase
        .from("orders")
        .select("id, order_number, status, total, currency, created_at, restaurant_tables(label)")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const counts = {
    categories: categories.count ?? 0,
    products: products.count ?? 0,
    tables: tables.count ?? 0,
    openOrders: openOrders.count ?? 0,
    waiters: pendingWaiters.count ?? 0,
  };

  const checklist = [
    { done: true, label: t("dash.checkRestaurant"), href: "/dashboard/restaurant" },
    { done: counts.categories > 0, label: t("dash.checkCategories"), href: "/dashboard/categories" },
    { done: counts.products > 0, label: t("dash.checkProducts"), href: "/dashboard/products" },
    { done: counts.tables > 0, label: t("dash.checkTables"), href: "/dashboard/tables" },
    { done: restaurant.status === "active", label: t("dash.checkActive"), href: "/dashboard/settings" },
  ];

  const stats = [
    { label: t("nav.categories"), value: counts.categories, href: "/dashboard/categories" },
    { label: t("nav.products"), value: counts.products, href: "/dashboard/products" },
    { label: t("nav.tables"), value: counts.tables, href: "/dashboard/tables" },
    { label: t("dash.openOrders"), value: counts.openOrders, href: "/dashboard/orders" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={restaurant.name}
        description={absoluteUrl(`/${restaurant.slug}/menu`)}
        action={<StatusBadge status={restaurant.status} t={t} />}
      />

      <ActivationPanel restaurant={restaurant} />

      {counts.waiters > 0 && (
        <Link
          href="/dashboard/orders"
          className="flex items-center gap-3 rounded-2xl border border-brand-300 bg-brand-50 px-5 py-4 transition-colors hover:bg-brand-100"
        >
          <span className="text-xl">🔔</span>
          <span className="text-sm font-medium text-brand-900">
            {t("dash.waiterWaiting", { count: counts.waiters })}
          </span>
          <Icon.chevronRight className="ms-auto size-4 rtl-flip text-brand-700" />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-2xl border border-ink-200 bg-white p-4 transition-colors hover:border-ink-300 sm:p-5"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{stat.label}</p>
            <p className="ltr-nums mt-1.5 text-2xl font-semibold text-ink-900 sm:text-3xl">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-ink-900">{t("dash.yourSetup")}</h2>
          <ul className="mt-4 space-y-2.5">
            {checklist.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-ink-50"
                >
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full text-white ${
                      item.done ? "bg-emerald-600" : "bg-ink-300"
                    }`}
                  >
                    {item.done ? (
                      <Icon.check className="size-3" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span className={item.done ? "text-ink-500 line-through" : "text-ink-800"}>
                    {item.label}
                  </span>
                  <Icon.chevronRight className="ms-auto size-4 rtl-flip text-ink-300" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink-900">{t("dash.recentOrders")}</h2>
            <Link href="/dashboard/orders" className="text-sm text-brand-700 hover:underline">
              {t("dash.viewAll")}
            </Link>
          </div>
          {(recentOrders.data?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-ink-500">
              {t("dash.noOrders")}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-ink-100">
              {recentOrders.data!.map((order) => {
                const table = order.restaurant_tables as unknown as { label: string } | null;
                return (
                  <li key={order.id} className="flex items-center gap-3 py-2.5">
                    <span className="text-sm font-medium text-ink-900">#{order.order_number}</span>
                    <span className="truncate text-sm text-ink-500">{table?.label ?? "—"}</span>
                    <span className="ms-auto text-sm font-medium text-ink-900">
                      <span className="ltr-nums">{formatMoney(Number(order.total), order.currency)}</span>
                    </span>
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-600">
                      {t(`status.${order.status}` as TranslationKey)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
