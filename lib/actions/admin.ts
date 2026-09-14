"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { RESTAURANT_STATUSES, type RestaurantStatus } from "@/lib/constants";
import type { ActionState } from "@/lib/types";
import { assertAdmin, done, fail, sanitiseImageUrl } from "./helpers";

export async function setRestaurantStatusAction(
  restaurantId: string,
  status: string,
  notes?: string
): Promise<ActionState> {
  const admin = await assertAdmin();
  if (!admin.ok) return admin.error;

  if (!RESTAURANT_STATUSES.includes(status as RestaurantStatus)) {
    return fail("Unknown status.");
  }

  const supabase = await createServerSupabase();

  const { data: current } = await supabase
    .from("restaurants")
    .select("id, slug, activated_at, coupon_code")
    .eq("id", restaurantId)
    .maybeSingle();

  if (!current) return fail("Restaurant not found.");

  const patch: Record<string, unknown> = { status };
  if (status === "active") {
    patch.activated_at = current.activated_at ?? new Date().toISOString();
    patch.payment_status = "paid";
    patch.payment_method = "whatsapp_manual";
  }

  const { error } = await supabase.from("restaurants").update(patch).eq("id", restaurantId);
  if (error) return fail(error.message);

  if (status === "active") {
    await redeemCoupon(restaurantId, current.coupon_code ?? null, "menu");
  }

  await supabase.from("admin_actions").insert({
    restaurant_id: restaurantId,
    admin_id: admin.userId,
    action: `status:${status}`,
    notes: notes?.slice(0, 300) ?? null,
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  revalidatePath(`/${current.slug}/menu`);
  revalidatePath("/dashboard", "layout");

  const labels: Record<string, string> = {
    active: "Restaurant activated. Its public menu is live.",
    inactive: "Restaurant deactivated. Its public menu is hidden.",
    suspended: "Restaurant suspended.",
  };
  return done(labels[status]);
}

export async function setUserAdminAction(
  userId: string,
  isAdmin: boolean
): Promise<ActionState> {
  const admin = await assertAdmin();
  if (!admin.ok) return admin.error;
  if (userId === admin.userId && !isAdmin) {
    return fail("You cannot remove your own admin access.");
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: isAdmin })
    .eq("id", userId);

  if (error) return fail(error.message);

  revalidatePath("/admin/users");
  return done(isAdmin ? "Admin access granted." : "Admin access removed.");
}

export async function addLibraryImageAction(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const admin = await assertAdmin();
  if (!admin.ok) return admin.error;

  const url = String(form.get("url") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const group = String(form.get("group_name") ?? "").trim() || "Food";
  const category = String(form.get("category") ?? "").trim() || "Other";
  const keywords = String(form.get("keywords") ?? "")
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
  const license = String(form.get("license") ?? "").trim();
  const attribution = String(form.get("attribution") ?? "").trim();

  if (!url || !title) return fail("Image and title are required.");

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base || !url.startsWith(`${base}/storage/v1/object/public/menu-library/`)) {
    return fail("Upload the image file above — external image links are not accepted.");
  }
  if (!license) {
    return fail(
      "Record the licence for this image. Only upload photos you own or that are cleared for commercial use."
    );
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("menu_images").insert({
    url,
    title,
    group_name: group,
    category,
    keywords,
    license,
    attribution: attribution || null,
  });

  if (error) return fail(error.message);

  revalidatePath("/admin/library");
  revalidatePath("/api/library");
  return done("Image added to the library.");
}

export async function deleteLibraryImageAction(id: string): Promise<ActionState> {
  const admin = await assertAdmin();
  if (!admin.ok) return admin.error;

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("menu_images").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/admin/library");
  revalidatePath("/api/library");
  return done("Image removed.");
}

// ------------------------------------------------------------ qr templates

const QR_LAYOUTS = ["counter", "square", "tent"];
const QR_SCOPES = ["general", "table", "both"];

function colour(form: FormData, key: string, fallback: string) {
  const value = String(form.get(key) ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

export async function saveQrTemplateAction(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const admin = await assertAdmin();
  if (!admin.ok) return admin.error;

  const id = String(form.get("id") ?? "").trim();
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  if (!name) return fail("Give the design a name.");

  const layout = String(form.get("layout") ?? "counter");
  const scope = String(form.get("scope") ?? "both");

  const payload = {
    name,
    layout: QR_LAYOUTS.includes(layout) ? layout : "counter",
    scope: QR_SCOPES.includes(scope) ? scope : "both",
    bg_color: colour(form, "bg_color", "#1c1917"),
    panel_color: colour(form, "panel_color", "#ffffff"),
    accent_color: colour(form, "accent_color", "#ea580c"),
    text_color: colour(form, "text_color", "#ffffff"),
    qr_color: colour(form, "qr_color", "#1c1917"),
    headline: String(form.get("headline") ?? "").trim().slice(0, 60) || null,
    cta_text: String(form.get("cta_text") ?? "").trim().slice(0, 80) || null,
    is_active: form.get("is_active") === "on",
  };

  const supabase = await createServerSupabase();
  const { error } = id
    ? await supabase.from("qr_templates").update(payload).eq("id", id)
    : await supabase.from("qr_templates").insert(payload);

  if (error) return fail(error.message);

  revalidatePath("/admin/qr-designs");
  revalidatePath("/dashboard/qr-codes");
  return done(id ? "Design updated." : "Design added.");
}

export async function deleteQrTemplateAction(id: string): Promise<ActionState> {
  const admin = await assertAdmin();
  if (!admin.ok) return admin.error;

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("qr_templates").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/admin/qr-designs");
  revalidatePath("/dashboard/qr-codes");
  return done("Design removed.");
}

// ---------------------------------------------------------------- catalog

function parseCatalogVariants(raw: string): { name: string; price: number | null }[] {
  return raw
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((entry) => {
      // "Medium 11" or "Medium" — the price is only a starting hint.
      const match = entry.match(/^(.*?)[\s:]+([0-9]+(?:\.[0-9]+)?)$/);
      if (match) return { name: match[1].trim().slice(0, 40), price: Number(match[2]) };
      return { name: entry.slice(0, 40), price: null };
    })
    .filter((v) => v.name.length > 0);
}

// ------------------------------------------------------- catalog categories

export async function saveCatalogCategoryAction(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const admin = await assertAdmin();
  if (!admin.ok) return admin.error;

  const id = String(form.get("id") ?? "").trim();
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  if (name.length < 1) return fail("A name is required.", { name: "A name is required." });

  const payload = {
    name,
    description: String(form.get("description") ?? "").trim().slice(0, 200) || null,
    image_url: sanitiseImageUrl(String(form.get("image_url") ?? "").trim() || null),
    is_active: form.get("is_active") !== "off",
  };

  const supabase = await createServerSupabase();
  const { error } = id
    ? await supabase.from("catalog_categories").update(payload).eq("id", id)
    : await supabase.from("catalog_categories").insert(payload);

  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      return fail("A section with that name already exists.", { name: "Already used." });
    }
    return fail(error.message);
  }

  revalidatePath("/admin/catalog");
  revalidatePath("/dashboard/catalog");
  return done(id ? "Section updated." : "Section added.");
}

/**
 * Deleting a section never deletes its dishes — `category_id` is
 * `on delete set null`, so they land in "Not filed yet" and can be moved.
 */
export async function deleteCatalogCategoryAction(id: string): Promise<ActionState> {
  const admin = await assertAdmin();
  if (!admin.ok) return admin.error;

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("catalog_categories").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/admin/catalog");
  revalidatePath("/dashboard/catalog");
  return done("Section removed. Its dishes are still in the catalog.");
}

export async function moveCatalogCategoryAction(
  id: string,
  direction: "up" | "down"
): Promise<ActionState> {
  const admin = await assertAdmin();
  if (!admin.ok) return admin.error;

  const supabase = await createServerSupabase();
  const { data: rows, error: readError } = await supabase
    .from("catalog_categories")
    .select("id, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .limit(500);

  if (readError) return fail(readError.message);
  const list = rows ?? [];
  const index = list.findIndex((row) => row.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= list.length) return done();

  // Rewrite the whole column rather than swapping two values: the seeded rows
  // all start at sort_order 0, so swapping alone would not move anything.
  const reordered = [...list];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(swapWith, 0, moved);

  const results = await Promise.all(
    reordered.map((row, position) =>
      supabase.from("catalog_categories").update({ sort_order: position }).eq("id", row.id)
    )
  );

  // A half-applied reorder leaves duplicate sort_order values, so say so
  // rather than reporting success.
  const failed = results.find((result) => result.error);
  if (failed?.error) return fail(failed.error.message);

  revalidatePath("/admin/catalog");
  revalidatePath("/dashboard/catalog");
  return done();
}

/** An empty money field means "no guidance", not zero. */
function optionalMoney(form: FormData, key: string): number | null {
  const raw = String(form.get(key) ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

export async function saveCatalogItemAction(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const admin = await assertAdmin();
  if (!admin.ok) return admin.error;

  const id = String(form.get("id") ?? "").trim();
  const name = String(form.get("name") ?? "").trim().slice(0, 90);
  if (!name) return fail("A name is required.");

  const categoryId = String(form.get("category_id") ?? "").trim();

  const payload = {
    name,
    description: String(form.get("description") ?? "").trim().slice(0, 400) || null,
    ingredients: String(form.get("ingredients") ?? "").trim().slice(0, 300) || null,
    // `category_name` is written by a trigger from the section, so it is
    // deliberately absent here — sending it would let a stale form value
    // overwrite the real label.
    category_id: categoryId || null,
    suggested_price: optionalMoney(form, "suggested_price"),
    price_min: optionalMoney(form, "price_min"),
    price_max: optionalMoney(form, "price_max"),
    suggested_currency:
      String(form.get("suggested_currency") ?? "").trim().toUpperCase().slice(0, 8) || "EGP",
    cuisine: String(form.get("cuisine") ?? "").trim().slice(0, 60) || null,
    image_url: sanitiseImageUrl(String(form.get("image_url") ?? "").trim() || null),
    variants: parseCatalogVariants(String(form.get("variants") ?? "")),
    keywords: String(form.get("keywords") ?? "")
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 12),
    is_active: form.get("is_active") !== "off",
  };

  const supabase = await createServerSupabase();
  const { error } = id
    ? await supabase.from("catalog_items").update(payload).eq("id", id)
    : await supabase.from("catalog_items").insert(payload);

  if (error) return fail(error.message);

  revalidatePath("/admin/catalog");
  revalidatePath("/dashboard/catalog");
  return done(id ? "Item updated." : "Item added to the catalog.");
}

export async function deleteCatalogItemAction(id: string): Promise<ActionState> {
  const admin = await assertAdmin();
  if (!admin.ok) return admin.error;

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("catalog_items").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/admin/catalog");
  revalidatePath("/dashboard/catalog");
  return done("Item removed.");
}

// -------------------------------------------------------------- coupons

export async function saveCouponAction(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const admin = await assertAdmin();
  if (!admin.ok) return admin.error;

  const id = String(form.get("id") ?? "").trim();
  const code = String(form.get("code") ?? "").trim().toUpperCase().slice(0, 24);
  const kind = String(form.get("kind") ?? "percent");
  const value = Number(String(form.get("value") ?? "").trim());
  const appliesTo = String(form.get("applies_to") ?? "both");
  const maxRaw = String(form.get("max_redemptions") ?? "").trim();
  const expiresRaw = String(form.get("expires_at") ?? "").trim();

  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) {
    return fail("Please check the form.", {
      code: "3–24 characters: letters, digits, - or _.",
    });
  }
  if (kind !== "percent" && kind !== "fixed") return fail("Pick a discount type.");
  if (!Number.isFinite(value) || value <= 0) {
    return fail("Please check the form.", { value: "Enter an amount above zero." });
  }
  if (kind === "percent" && value > 100) {
    return fail("Please check the form.", { value: "A percentage cannot exceed 100." });
  }
  if (!["menu", "pos", "both"].includes(appliesTo)) return fail("Pick what it applies to.");

  const maxRedemptions = maxRaw ? Math.max(1, Math.floor(Number(maxRaw))) : null;
  if (maxRaw && !Number.isFinite(Number(maxRaw))) {
    return fail("Please check the form.", { max_redemptions: "Enter a whole number." });
  }

  const payload = {
    code,
    kind,
    value,
    applies_to: appliesTo,
    max_redemptions: maxRedemptions,
    // `type="date"` gives "2026-01-31", which Date reads as UTC midnight at the
    // START of that day — so the stated last day was already dead. End of day.
    expires_at: parseEndOfDay(expiresRaw),
    note: String(form.get("note") ?? "").trim().slice(0, 200) || null,
    is_active: form.get("is_active") !== "off",
  };

  const supabase = await createServerSupabase();
  const { error } = id
    ? await supabase.from("coupons").update(payload).eq("id", id)
    : await supabase.from("coupons").insert({ ...payload, created_by: admin.userId });

  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      return fail("That code already exists.", { code: "Already used." });
    }
    return fail(error.message);
  }

  revalidatePath("/admin/coupons");
  return done(id ? "Coupon updated." : "Coupon created.");
}

function parseEndOfDay(raw: string): string | null {
  if (!raw) return null;
  const parsed = new Date(`${raw}T23:59:59.999Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function deleteCouponAction(id: string): Promise<ActionState> {
  const admin = await assertAdmin();
  if (!admin.ok) return admin.error;

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/admin/coupons");
  return done("Coupon removed.");
}

// ------------------------------------------------------------------ POS

/**
 * Turning POS on or off for a restaurant. Admin-only on both sides: the
 * action checks, and a database trigger refuses these columns to anyone else.
 */
export async function setPosStatusAction(
  restaurantId: string,
  status: string,
  plan: string | null
): Promise<ActionState> {
  const admin = await assertAdmin();
  if (!admin.ok) return admin.error;

  if (!["none", "requested", "active", "expired", "cancelled"].includes(status)) {
    return fail("Unknown status.");
  }
  if (plan && plan !== "monthly" && plan !== "yearly") return fail("Unknown plan.");

  const supabase = await createServerSupabase();
  const { data: current } = await supabase
    .from("restaurants")
    .select("pos_started_at, pos_expires_at, coupon_code")
    .eq("id", restaurantId)
    .maybeSingle();

  const now = new Date();

  // Renewing early must not throw away time already paid for, so a new term
  // starts at the current expiry while that is still in the future.
  const currentExpiry = current?.pos_expires_at ? new Date(current.pos_expires_at) : null;
  const from = status === "active" && currentExpiry && currentExpiry > now ? currentExpiry : now;

  // Whole days rather than setMonth/setFullYear: adding a month to 31 January
  // lands on 3 March, which quietly gives service away.
  const expires = new Date(from);
  expires.setUTCDate(expires.getUTCDate() + (plan === "monthly" ? 30 : 365));

  const patch: Record<string, unknown> = {
    pos_status: status,
    pos_plan: status === "active" ? (plan ?? "yearly") : plan,
  };

  if (status === "active") {
    patch.pos_started_at = current?.pos_started_at ?? now.toISOString();
    patch.pos_expires_at = expires.toISOString();
  }
  // Ending a subscription keeps the dates: when it started and when it ran out
  // is exactly what you want to look at afterwards.

  const { error } = await supabase.from("restaurants").update(patch).eq("id", restaurantId);

  if (error) return fail(error.message);

  if (status === "active") {
    await redeemCoupon(restaurantId, current?.coupon_code ?? null, "pos");
  }

  await supabase.from("admin_actions").insert({
    restaurant_id: restaurantId,
    admin_id: admin.userId,
    action: `pos:${status}`,
    notes: plan ? `plan=${plan}` : null,
  });

  revalidatePath(`/admin/restaurants/${restaurantId}`);
  revalidatePath("/dashboard/billing");
  return done(status === "active" ? "POS activated." : "POS updated.");
}

/**
 * Books a coupon against a restaurant, once per product.
 *
 * Called at the moment money is confirmed — an admin switching something on —
 * because that is the only point at which a redemption is real. The unique
 * constraint on (coupon, restaurant, product) makes a repeat call a no-op, so
 * re-activating does not burn another use.
 */
async function redeemCoupon(
  restaurantId: string,
  code: string | null,
  appliedTo: "menu" | "pos"
): Promise<void> {
  if (!code) return;

  try {
    const supabase = await createServerSupabase();
    const { data: coupon } = await supabase
      .from("coupons")
      .select("id, redeemed_count")
      .ilike("code", code.trim())
      .maybeSingle();

    if (!coupon) return;

    const { error } = await supabase.from("coupon_redemptions").insert({
      coupon_id: coupon.id,
      restaurant_id: restaurantId,
      applied_to: appliedTo,
    });

    // Already booked for this product — leave the counter alone.
    if (error) return;

    await supabase
      .from("coupons")
      .update({ redeemed_count: (Number(coupon.redeemed_count) || 0) + 1 })
      .eq("id", coupon.id);
  } catch {
    // Never let bookkeeping block an activation the admin just authorised.
  }
}

// ------------------------------------------------------------- platform

export async function savePlatformSettingsAction(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const admin = await assertAdmin();
  if (!admin.ok) return admin.error;

  const whatsapp = String(form.get("support_whatsapp") ?? "").trim().slice(0, 40);
  if (whatsapp.replace(/\D/g, "").length < 8) {
    return fail("Enter a valid WhatsApp number in international format.");
  }

  const price = Number(String(form.get("price_usd") ?? "").trim());
  if (!Number.isFinite(price) || price < 0) return fail("Enter a valid price.");

  const money = (field: string, fallback: number) => {
    const raw = String(form.get(field) ?? "").trim();
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };

  const bundle = money("menu_bundle_usd", 8);
  const posMonthly = money("pos_monthly_usd", 2);
  const posYearly = money("pos_yearly_usd", 20);

  if (bundle > price) return fail("The bundle price cannot be higher than the full price.");

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("platform_settings")
    .upsert(
      {
        id: 1,
        support_whatsapp: whatsapp,
        support_email: String(form.get("support_email") ?? "").trim().slice(0, 120) || null,
        brand_name: String(form.get("brand_name") ?? "").trim().slice(0, 40) || "MenuzQR",
        price_usd: price,
        menu_bundle_usd: bundle,
        pos_monthly_usd: posMonthly,
        pos_yearly_usd: posYearly,
        pos_enabled: form.get("pos_enabled") === "on",
        activation_note: String(form.get("activation_note") ?? "").trim().slice(0, 300) || null,
      },
      { onConflict: "id" }
    );

  if (error) return fail(error.message);

  // The number appears on the landing page, every dashboard and the
  // "menu unavailable" page, so refresh the whole tree.
  revalidatePath("/", "layout");
  return done("Platform settings saved.");
}
