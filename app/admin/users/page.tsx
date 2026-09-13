import type { Metadata } from "next";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, EmptyState } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icons";
import { AdminToggle } from "@/components/admin/AdminToggle";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Admin — Users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const [supabase, t] = await Promise.all([createServerSupabase(), getT()]);

  let query = supabase
    .from("profiles")
    .select("id, email, full_name, is_admin, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (q.trim()) {
    // Strip PostgREST filter metacharacters so a comma or bracket in the query
    // cannot break out of the expression (which silently 400s the request).
    const term = q.trim().replace(/[,()*:"\\]/g, "");
    if (term) query = query.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
  }

  const { data: profiles } = await query;

  const ids = (profiles ?? []).map((p) => p.id);
  const { data: restaurants } = ids.length
    ? await supabase.from("restaurants").select("id, name, slug, owner_id, status").in("owner_id", ids)
    : { data: [] };

  const byOwner = new Map<string, { id: string; name: string; slug: string; status: string }[]>();
  for (const r of restaurants ?? []) {
    byOwner.set(r.owner_id, [...(byOwner.get(r.owner_id) ?? []), r]);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">{t("admin.users")}</h1>
        <p className="mt-1 text-sm text-ink-500">{t("admin.users")}</p>
      </div>

      <form className="relative max-w-md">
        <Icon.search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <input
          name="q"
          defaultValue={q}
          placeholder={t("admin.searchUsers")}
          aria-label={t("admin.searchUsers")}
          className="h-10 w-full rounded-xl border border-ink-200 bg-white ps-9 pe-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </form>

      {(profiles?.length ?? 0) === 0 ? (
        <EmptyState title={t("admin.noUsers")} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-ink-100">
            {profiles!.map((profile) => {
              const owned = byOwner.get(profile.id) ?? [];
              return (
                <li key={profile.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-48 flex-1">
                    <p className="font-medium text-ink-900">
                      {profile.full_name || profile.email || "Unnamed user"}
                    </p>
                    <p className="truncate text-xs text-ink-500">
                      {profile.email} · joined {formatDate(profile.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {owned.length === 0 ? (
                      <span className="text-xs text-ink-400">No restaurant</span>
                    ) : (
                      owned.map((r) => (
                        <Link
                          key={r.id}
                          href={`/admin/restaurants/${r.id}`}
                          className="rounded-lg bg-ink-100 px-2.5 py-1 text-xs text-ink-700 hover:bg-ink-200"
                        >
                          {r.name}
                        </Link>
                      ))
                    )}
                  </div>

                  <AdminToggle userId={profile.id} isAdmin={profile.is_admin} />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
