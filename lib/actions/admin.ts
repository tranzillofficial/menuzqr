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
    .select("id, slug, activated_at")
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

export async function saveCatalogItemAction(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const admin = await assertAdmin();
  if (!admin.ok) return admin.error;

  const id = String(form.get("id") ?? "").trim();
  const name = String(form.get("name") ?? "").trim().slice(0, 90);
  if (!name) return fail("A name is required.");

  const payload = {
    name,
    description: String(form.get("description") ?? "").trim().slice(0, 400) || null,
    ingredients: String(form.get("ingredients") ?? "").trim().slice(0, 300) || null,
    category_name: String(form.get("category_name") ?? "").trim().slice(0, 60) || null,
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
  return done(id ? "Item updated." : "Item added to the catalog.");
}

export async function deleteCatalogItemAction(id: string): Promise<ActionState> {
  const admin = await assertAdmin();
  if (!admin.ok) return admin.error;

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("catalog_items").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/admin/catalog");
  return done("Item removed.");
}
