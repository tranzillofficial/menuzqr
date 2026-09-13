import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { ActionState, Restaurant } from "@/lib/types";

export const ASSET_BUCKET = "restaurant-assets";
export const LIBRARY_BUCKET = "menu-library";

export function fail(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, message, fieldErrors };
}

export function done(message?: string): ActionState {
  return { ok: true, message };
}

export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optionalStr(form: FormData, key: string): string | null {
  const v = str(form, key);
  return v.length > 0 ? v : null;
}

export function bool(form: FormData, key: string): boolean {
  const v = form.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function num(form: FormData, key: string, fallback = 0): number {
  const v = Number(str(form, key));
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Resolves the signed-in user's restaurant and asserts they may manage it.
 * Throws for callers that should never reach the action without a restaurant.
 */
export async function getOwnedRestaurant(): Promise<
  | { ok: true; restaurant: Restaurant; userId: string }
  | { ok: false; error: ActionState }
> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: fail("You need to sign in first.") };

  const { data } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { ok: false, error: fail("Create your restaurant profile first.") };
  }

  return { ok: true, restaurant: data as Restaurant, userId: user.id };
}

export async function assertAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; error: ActionState }
> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: fail("You need to sign in first.") };

  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!data?.is_admin) return { ok: false, error: fail("Admin access required.") };
  return { ok: true, userId: user.id };
}

/**
 * Removes a previously uploaded asset once it has been replaced.
 * Silently ignores anything that is not one of our own storage objects.
 */
export async function deleteAssetIfOwned(url: string | null | undefined, restaurantId: string) {
  if (!url) return;
  const marker = `/storage/v1/object/public/${ASSET_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;

  const path = decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
  if (!path.startsWith(`${restaurantId}/`)) return;

  try {
    await createAdminSupabase().storage.from(ASSET_BUCKET).remove([path]);
  } catch {
    // Storage cleanup is best-effort; never fail the user's save because of it.
  }
}

/**
 * Accepts only public URLs from our own Supabase Storage buckets — a restaurant
 * asset or a shared library image. Anything else (an external hotlink pasted
 * into a form, a javascript: URL) is dropped.
 */
export function sanitiseImageUrl(url: string | null): string | null {
  if (!url) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  for (const bucket of [ASSET_BUCKET, LIBRARY_BUCKET]) {
    if (url.startsWith(`${base}/storage/v1/object/public/${bucket}/`)) return url;
  }
  return null;
}
