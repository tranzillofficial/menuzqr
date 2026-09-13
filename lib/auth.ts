import "server-only";

import { redirect } from "next/navigation";
import { createServerSupabase } from "./supabase/server";
import type { Profile, Restaurant } from "./types";

export async function getUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (data as Profile | null) ?? null;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.is_admin) redirect("/dashboard");
  return profile;
}

/** The restaurant owned by the signed-in user, or null if they have not created one. */
export async function getMyRestaurant(): Promise<Restaurant | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (data as Restaurant | null) ?? null;
}

/** Redirects to onboarding when the signed-in user has no restaurant yet. */
export async function requireRestaurant(): Promise<Restaurant> {
  await requireUser();
  const restaurant = await getMyRestaurant();
  if (!restaurant) redirect("/dashboard/restaurant");
  return restaurant;
}
