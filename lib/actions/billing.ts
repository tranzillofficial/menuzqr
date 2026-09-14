"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { POS_PLANS, type PosPlan } from "@/lib/constants";
import type { ActionState, CouponPreview } from "@/lib/types";
import { done, fail, getOwnedRestaurant } from "./helpers";

/**
 * Checks one coupon code the owner was given.
 *
 * Goes through the `preview_coupon` SQL function rather than reading the
 * table: the coupons table is admin-only precisely so an owner cannot list
 * every code, and this returns the discount for a single code and nothing else.
 */
export async function previewCouponAction(
  code: string,
  target: "menu" | "pos"
): Promise<CouponPreview> {
  const trimmed = (code ?? "").trim();
  // 8 is the floor everywhere: a 3-character code is only ~59k guesses.
  if (trimmed.length < 8 || trimmed.length > 24) return { valid: false, reason: "unavailable" };
  if (target !== "menu" && target !== "pos") return { valid: false, reason: "unavailable" };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("preview_coupon", {
    coupon_code: trimmed,
    target,
  });

  if (error) return { valid: false, reason: "unavailable" };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.valid) return { valid: false, reason: String(row?.reason ?? "unavailable") };

  return {
    valid: true,
    kind: row.kind === "fixed" ? "fixed" : "percent",
    value: Number(row.value) || 0,
    appliesTo: row.applies_to ?? "both",
  };
}

/**
 * The owner raising a hand for POS. It does not grant anything — a database
 * trigger allows exactly this one transition and nothing else, so the plan is
 * only a note of what they asked for until an admin activates it.
 */
export async function requestPosAction(plan: string, code: string): Promise<ActionState> {
  const owned = await getOwnedRestaurant();
  if (!owned.ok) return owned.error;

  if (!POS_PLANS.includes(plan as PosPlan)) return fail("Pick a plan.");
  if (owned.restaurant.pos_status === "active") return done("POS is already active.");

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("restaurants")
    .update({
      pos_status: "requested",
      pos_plan: plan,
      coupon_code: await validatedCoupon(code, "pos"),
    })
    .eq("id", owned.restaurant.id)
    .select("pos_status")
    .maybeSingle();

  if (error) return fail(error.message);

  // The guard trigger rewrites the row rather than raising, so a refused
  // transition comes back as a clean success. Read it back and say the truth.
  if (data?.pos_status !== "requested") {
    return fail("We couldn't record that request. Please message us on WhatsApp.");
  }

  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard/settings");
  return done("Noted. Send us the payment on WhatsApp and we'll switch it on.");
}

export async function cancelPosRequestAction(): Promise<ActionState> {
  const owned = await getOwnedRestaurant();
  if (!owned.ok) return owned.error;
  if (owned.restaurant.pos_status !== "requested") return done();

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("restaurants")
    .update({ pos_status: "none", pos_plan: null })
    .eq("id", owned.restaurant.id);

  if (error) return fail(error.message);

  revalidatePath("/dashboard/billing");
  return done("Request withdrawn.");
}

/** Records the code an owner intends to use on the one-time menu fee. */
export async function saveMenuCouponAction(code: string): Promise<ActionState> {
  const owned = await getOwnedRestaurant();
  if (!owned.ok) return owned.error;

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("restaurants")
    .update({ coupon_code: await validatedCoupon(code, "menu") })
    .eq("id", owned.restaurant.id);

  if (error) return fail(error.message);

  revalidatePath("/dashboard/billing");
  return done();
}

/**
 * Only a code the server itself has accepted is ever stored.
 *
 * Without this, the column is whatever the client posted — and an admin
 * looking at the restaurant page would see an authoritative-looking badge for
 * a code that was never real.
 */
async function validatedCoupon(code: string, target: "menu" | "pos"): Promise<string | null> {
  const trimmed = (code ?? "").trim().slice(0, 24);
  if (!trimmed) return null;

  const forTarget = await previewCouponAction(trimmed, target);
  if (forTarget.valid) return trimmed.toUpperCase();

  // A "menu" request may carry a POS-only code and vice versa; accept either,
  // because the admin applies it to whichever product it belongs to.
  const other = await previewCouponAction(trimmed, target === "menu" ? "pos" : "menu");
  return other.valid ? trimmed.toUpperCase() : null;
}
