import Link from "next/link";
import type { Metadata } from "next";
import { createServerSupabase } from "@/lib/supabase/server";
import { RestaurantActions } from "@/components/admin/RestaurantActions";
import { StatusBadge } from "@/components/dashboard/ActivationPanel";
import { Card, EmptyState } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icons";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import type { Restaurant } from "@/lib/types";

export const metadata: Metadata = { title: "Admin — Restaurants" };

export default async function AdminRestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "" } = await searchParams;
  const [supabase, t] = await Promise.all([createServerSupabase(), getT()]);

  let query = supabase
    .from("restaurants")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (q.trim()) {
    // Strip PostgREST filter metacharacters so a comma or bracket in the query
    // cannot break out of the expression (which silently 400s the request).
    const term = q.trim().replace(/[,()*:"\\]/g, "");
    if (term) query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%`);
  }
  if (status) query = query.eq("status", status);

  const { data } = await query;
  const restaurants = (data ?? []) as Restaurant[];

  const ownerIds = [...new Set(restaurants.map((r) => r.owner_id))];
  const { data: owners } = ownerIds.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", ownerIds)
    : { data: [] };

  const ownerById = Object.fromEntries((owners ?? []).map((o) => [o.id, o]));

  const counts = {
    total: restaurants.length,
    active: restaurants.filter((r) => r.status === "active").length,
    pending: restaurants.filter((r) => r.status === "inactive").length,
    suspended: restaurants.filter((r) => r.status === "suspended").length,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">{t("admin.restaurants")}</h1>
        <p className="mt-1 text-sm text-ink-500">
          {t("admin.restaurantsSub")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t("admin.all"), counts.total, ""],
          [t("activation.statusActive"), counts.active, "active"],
          [t("activation.statusPending"), counts.pending, "inactive"],
          [t("activation.statusSuspended"), counts.suspended, "suspended"],
        ].map(([label, value, filterValue]) => (
          <Link
            key={label as string}
            href={filterValue ? `/admin?status=${filterValue}` : "/admin"}
            className={`rounded-2xl border bg-white p-3 transition-colors sm:p-4 ${
              status === filterValue ? "border-brand-400 ring-1 ring-brand-100" : "border-ink-200"
            }`}
          >
            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-ink-500 sm:text-xs">{label}</p>
            <p className="ltr-nums mt-1 text-xl font-semibold text-ink-900 sm:text-2xl">{value}</p>
          </Link>
        ))}
      </div>

      <form className="relative max-w-md">
        <Icon.search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        {status && <input type="hidden" name="status" value={status} />}
        <input
          name="q"
          defaultValue={q}
          placeholder={t("admin.searchRestaurants")}
          aria-label={t("admin.searchRestaurants")}
          className="h-10 w-full rounded-xl border border-ink-200 bg-white ps-9 pe-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </form>

      {restaurants.length === 0 ? (
        <EmptyState title={t("admin.noRestaurants")} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-ink-100">
            {restaurants.map((restaurant) => {
              const owner = ownerById[restaurant.owner_id];
              return (
                <li key={restaurant.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="w-full min-w-0 flex-1 sm:w-auto sm:min-w-48">
                    <Link
                      href={`/admin/restaurants/${restaurant.id}`}
                      className="font-medium text-ink-900 hover:underline"
                    >
                      {restaurant.name}
                    </Link>
                    <p className="truncate text-xs text-ink-500">
                      /{restaurant.slug} · {owner?.email ?? "unknown owner"} ·{" "}
                      {formatDate(restaurant.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={restaurant.status} t={t} />
                  <RestaurantActions
                    restaurantId={restaurant.id}
                    restaurantName={restaurant.name}
                    status={restaurant.status}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
