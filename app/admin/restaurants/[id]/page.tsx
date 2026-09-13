import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServerSupabase } from "@/lib/supabase/server";
import { RestaurantActions } from "@/components/admin/RestaurantActions";
import { StatusBadge } from "@/components/dashboard/ActivationPanel";
import { Card, CardHeader, EmptyState } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icons";
import { formatDate, formatMoney, relativeTime } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n";
import type { Restaurant } from "@/lib/types";

export const metadata: Metadata = { title: "Admin — Restaurant" };

export default async function AdminRestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [supabase, t] = await Promise.all([createServerSupabase(), getT()]);

  const { data } = await supabase.from("restaurants").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const restaurant = data as Restaurant;

  const [owner, categories, products, tables, orders, actions, team] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name").eq("id", restaurant.owner_id).maybeSingle(),
    supabase.from("categories").select("id, name, is_active").eq("restaurant_id", id).order("sort_order"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("restaurant_id", id),
    supabase.from("restaurant_tables").select("id, label, is_active").eq("restaurant_id", id).order("sort_order"),
    supabase
      .from("orders")
      .select("id, order_number, status, total, currency, created_at")
      .eq("restaurant_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("admin_actions")
      .select("id, action, notes, created_at")
      .eq("restaurant_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("restaurant_members")
      .select("id, user_id, role, display_name, is_active, created_at")
      .eq("restaurant_id", id)
      .order("created_at", { ascending: true }),
  ]);

  // `restaurant_members.user_id` references auth.users, so the emails are
  // fetched separately rather than embedded.
  const teamIds = (team.data ?? []).map((m) => m.user_id);
  const { data: teamProfiles } = teamIds.length
    ? await supabase.from("profiles").select("id, email").in("id", teamIds)
    : { data: [] as Array<{ id: string; email: string | null }> };
  const teamEmail = new Map((teamProfiles ?? []).map((p) => [p.id, p.email]));

  return (
    <div className="space-y-5">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
        ← All restaurants
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">{restaurant.name}</h1>
          <p className="mt-1 text-sm text-ink-500">
            /{restaurant.slug} · owner {owner.data?.email ?? "unknown"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={restaurant.status} t={t} />
          <Link
            href={`/${restaurant.slug}/menu`}
            target="_blank"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-[13px] font-medium text-ink-700 hover:bg-ink-50"
          >
            <Icon.external className="size-3.5" />
            {t("admin.viewMenu")}
          </Link>
        </div>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink-900">Activation</h2>
        <p className="mt-1 text-sm text-ink-500">
          {restaurant.status === "active"
            ? `Activated ${formatDate(restaurant.activated_at)}.`
            : "Not activated yet. Confirm the $20 payment before activating."}
        </p>
        <div className="mt-4">
          <RestaurantActions
            restaurantId={restaurant.id}
            restaurantName={restaurant.name}
            status={restaurant.status}
            size="md"
          />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Categories", categories.data?.length ?? 0],
          ["Products", products.count ?? 0],
          ["Tables", tables.data?.length ?? 0],
          ["Payment", restaurant.payment_status === "paid" ? "Paid" : "Unpaid"],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-2xl border border-ink-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-ink-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Menu structure" />
          <div className="p-5">
            {(categories.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-ink-500">No categories yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {categories.data!.map((c) => (
                  <li
                    key={c.id}
                    className={`rounded-lg px-2.5 py-1 text-xs ${
                      c.is_active ? "bg-ink-100 text-ink-700" : "bg-ink-50 text-ink-400 line-through"
                    }`}
                  >
                    {c.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Tables" />
          <div className="p-5">
            {(tables.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-ink-500">No tables yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {tables.data!.map((t) => (
                  <li
                    key={t.id}
                    className={`rounded-lg px-2.5 py-1 text-xs ${
                      t.is_active ? "bg-ink-100 text-ink-700" : "bg-ink-50 text-ink-400 line-through"
                    }`}
                  >
                    {t.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent orders" />
          <div className="p-5">
            {(orders.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-ink-500">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {orders.data!.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="font-medium">#{o.order_number}</span>
                    <span className="text-ink-500">
                      {t(`status.${o.status}` as TranslationKey)}
                    </span>
                    <span className="ms-auto">{formatMoney(Number(o.total), o.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Team accounts"
            description="Sub-accounts this owner created. Created and managed by them, listed here for support."
          />
          <div className="p-5">
            {(team.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-ink-500">No team accounts yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {team.data!.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-ink-100 px-2 py-0.5 font-mono text-xs">
                      {m.role}
                    </span>
                    <span className="font-medium text-ink-900">{m.display_name ?? "—"}</span>
                    <span className="truncate text-ink-500">{teamEmail.get(m.user_id) ?? ""}</span>
                    {!m.is_active && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        disabled
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Admin audit trail" />
          <div className="p-5">
            {(actions.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-ink-500">No admin actions recorded.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {actions.data!.map((a) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <span className="rounded-lg bg-ink-100 px-2 py-0.5 font-mono text-xs">
                      {a.action}
                    </span>
                    <span className="text-ink-500">{relativeTime(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {restaurant.status !== "active" && (
        <EmptyState
          title="Public menu is locked"
          description="Guests scanning this restaurant's QR codes see a “menu unavailable” page until you activate it."
        />
      )}
    </div>
  );
}
