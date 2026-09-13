import "server-only";

import { redirect } from "next/navigation";
import { createServerSupabase } from "./supabase/server";
import { MANAGER_ROLES, type MemberRole } from "./constants";
import type { Restaurant } from "./types";

export type Membership = {
  userId: string;
  email: string;
  restaurant: Restaurant;
  role: MemberRole;
  memberId: string;
  displayName: string;
  /** Owner and manager get the dashboard; everyone else gets /station. */
  isManager: boolean;
};

const ROLE_RANK: Record<string, number> = {
  owner: 0,
  manager: 1,
  chef: 2,
  waiter: 3,
  staff: 4,
};

/**
 * Resolves the signed-in user's place in a restaurant.
 *
 * Membership is the single source of truth — an owner gets a row from the
 * `handle_new_restaurant` trigger, staff get one when the owner creates them.
 * When several memberships exist the most privileged one wins.
 */
export async function getMembership(): Promise<Membership | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows } = await supabase
    .from("restaurant_members")
    .select("id, role, display_name, is_active, restaurant_id, restaurants(*)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const members = (rows ?? [])
    .map((row) => {
      // PostgREST types an embedded one-to-one as an array in some versions.
      const joined = row.restaurants as unknown;
      const restaurant = (Array.isArray(joined) ? joined[0] : joined) as Restaurant | null;
      return { row, restaurant };
    })
    .filter((m): m is { row: NonNullable<typeof rows>[number]; restaurant: Restaurant } =>
      Boolean(m.restaurant)
    )
    .sort((a, b) => (ROLE_RANK[a.row.role] ?? 9) - (ROLE_RANK[b.row.role] ?? 9));

  const best = members[0];
  if (!best) return null;

  const role = best.row.role as MemberRole;

  return {
    userId: user.id,
    email: user.email ?? "",
    restaurant: best.restaurant,
    role,
    memberId: best.row.id,
    displayName: best.row.display_name?.trim() || user.email?.split("@")[0] || "",
    isManager: MANAGER_ROLES.includes(role),
  };
}

/** Signed in, and a member of some restaurant. */
export async function requireMembership(next = "/dashboard"): Promise<Membership> {
  const membership = await getMembership();
  if (membership) return membership;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);

  // A staff account the owner switched off still signs in, but has no active
  // membership. Sending them to "create your restaurant" would quietly turn a
  // disabled waiter into the owner of a brand new restaurant.
  const { count } = await supabase
    .from("restaurant_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) > 0) redirect("/disabled");

  // Signed in with no membership at all — send them through onboarding.
  redirect("/dashboard/restaurant");
}

/** Owner or manager only. Staff are bounced to their station screen. */
export async function requireManager(next = "/dashboard"): Promise<Membership> {
  const membership = await requireMembership(next);
  if (!membership.isManager) redirect("/station");
  return membership;
}

/** Any member — used by the station screen, which owners can also open. */
export async function requireStation(): Promise<Membership> {
  return requireMembership("/station");
}
