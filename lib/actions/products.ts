"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import {
  bool,
  deleteAssetIfOwned,
  done,
  fail,
  getOwnedRestaurant,
  optionalStr,
  sanitiseImageUrl,
  str,
} from "./helpers";

function revalidate(slug: string) {
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
  revalidatePath(`/${slug}/menu`);
}

type VariantInput = { id?: string; name: string; price: number; is_active: boolean };

type VariantParse =
  | { ok: true; variants: VariantInput[] }
  | { ok: false; message: string };

function parseVariants(raw: string): VariantParse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || "[]");
  } catch {
    return { ok: false, message: "Could not read the sizes. Please try again." };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, message: "Could not read the sizes. Please try again." };
  }

  const variants: VariantInput[] = [];

  for (const entry of parsed.slice(0, 20)) {
    const o = entry as Record<string, unknown>;
    const name = (typeof o.name === "string" ? o.name.trim() : "").slice(0, 40);
    if (!name) continue;

    // Prices arrive as the raw input string so an empty field is an error
    // rather than silently becoming a free item.
    const rawPrice = typeof o.price === "string" ? o.price.trim() : o.price;
    if (rawPrice === "" || rawPrice === null || rawPrice === undefined) {
      return { ok: false, message: `Enter a price for "${name}".` };
    }
    const price = Number(rawPrice);
    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, message: `"${name}" needs a valid price.` };
    }

    variants.push({
      id: typeof o.id === "string" && o.id ? o.id : undefined,
      name,
      price: Math.round(price * 100) / 100,
      is_active: o.is_active !== false,
    });
  }

  return { ok: true, variants };
}

export async function saveProductAction(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const owned = await getOwnedRestaurant();
  if (!owned.ok) return owned.error;
  const { restaurant } = owned;

  const id = str(form, "id");
  const name = str(form, "name");
  if (!name) return fail("Product name is required.", { name: "Required." });

  const parsedVariants = parseVariants(str(form, "variants"));
  if (!parsedVariants.ok) {
    return fail(parsedVariants.message, { variants: parsedVariants.message });
  }
  const variants = parsedVariants.variants;
  if (variants.length === 0) {
    return fail("Add at least one size or price option.", {
      variants: "At least one size with a price is required.",
    });
  }

  const categoryId = optionalStr(form, "category_id");
  const imageUrl = sanitiseImageUrl(optionalStr(form, "image_url"));
  const imageSourceRaw = str(form, "image_source");
  const imageSource = imageUrl
    ? imageSourceRaw === "library"
      ? "library"
      : "uploaded"
    : "none";

  const supabase = await createServerSupabase();

  if (categoryId) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .eq("restaurant_id", restaurant.id)
      .maybeSingle();
    if (!cat) return fail("That category does not belong to your restaurant.");
  }

  const payload = {
    restaurant_id: restaurant.id,
    category_id: categoryId,
    name,
    description: optionalStr(form, "description"),
    ingredients: optionalStr(form, "ingredients"),
    image_url: imageUrl,
    image_source: imageSource,
    is_active: bool(form, "is_active"),
  };

  let productId = id;

  if (id) {
    const { data: current } = await supabase
      .from("products")
      .select("image_url")
      .eq("id", id)
      .eq("restaurant_id", restaurant.id)
      .maybeSingle();
    if (!current) return fail("Product not found.");

    const { error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", id)
      .eq("restaurant_id", restaurant.id);
    if (error) return fail(error.message);

    if (current.image_url && current.image_url !== imageUrl) {
      await deleteAssetIfOwned(current.image_url, restaurant.id);
    }
  } else {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id);

    const { data, error } = await supabase
      .from("products")
      .insert({ ...payload, sort_order: (count ?? 0) * 10 })
      .select("id")
      .single();
    if (error || !data) return fail(error?.message ?? "Could not create the product.");
    productId = data.id;
  }

  // --- sync variants -------------------------------------------------
  const { data: existingVariants } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId)
    .eq("restaurant_id", restaurant.id);

  const keptIds = new Set(variants.map((v) => v.id).filter(Boolean) as string[]);
  const toDelete = (existingVariants ?? []).map((v) => v.id).filter((vid) => !keptIds.has(vid));

  if (toDelete.length > 0) {
    await supabase
      .from("product_variants")
      .delete()
      .in("id", toDelete)
      .eq("restaurant_id", restaurant.id);
  }

  for (const [index, variant] of variants.entries()) {
    const row = {
      restaurant_id: restaurant.id,
      product_id: productId,
      name: variant.name,
      price: variant.price,
      is_active: variant.is_active,
      sort_order: index * 10,
    };
    if (variant.id) {
      const { error } = await supabase
        .from("product_variants")
        .update(row)
        .eq("id", variant.id)
        .eq("product_id", productId)
        .eq("restaurant_id", restaurant.id);
      if (error) return fail(error.message);
    } else {
      const { error } = await supabase.from("product_variants").insert(row);
      if (error) return fail(error.message);
    }
  }

  revalidate(restaurant.slug);
  return done(id ? "Product updated." : "Product added.");
}

export async function deleteProductAction(id: string): Promise<ActionState> {
  const owned = await getOwnedRestaurant();
  if (!owned.ok) return owned.error;

  const supabase = await createServerSupabase();
  const { data: current } = await supabase
    .from("products")
    .select("image_url")
    .eq("id", id)
    .eq("restaurant_id", owned.restaurant.id)
    .maybeSingle();

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", owned.restaurant.id);
  if (error) return fail(error.message);

  await deleteAssetIfOwned(current?.image_url, owned.restaurant.id);
  revalidate(owned.restaurant.slug);
  return done("Product deleted.");
}

export async function toggleProductAction(id: string, isActive: boolean): Promise<ActionState> {
  const owned = await getOwnedRestaurant();
  if (!owned.ok) return owned.error;

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("restaurant_id", owned.restaurant.id);
  if (error) return fail(error.message);

  revalidate(owned.restaurant.slug);
  return done(isActive ? "Product is visible." : "Product hidden from the menu.");
}

export async function moveProductAction(id: string, direction: "up" | "down"): Promise<ActionState> {
  const owned = await getOwnedRestaurant();
  if (!owned.ok) return owned.error;

  const supabase = await createServerSupabase();
  const { data: rows } = await supabase
    .from("products")
    .select("id, sort_order, category_id")
    .eq("restaurant_id", owned.restaurant.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!rows) return fail("Could not reorder.");

  const index = rows.findIndex((r) => r.id === id);
  if (index === -1) return fail("Product not found.");
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= rows.length) return done();

  const reordered = [...rows];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];

  await Promise.all(
    reordered.map((row, i) =>
      supabase
        .from("products")
        .update({ sort_order: i * 10 })
        .eq("id", row.id)
        .eq("restaurant_id", owned.restaurant.id)
    )
  );

  revalidate(owned.restaurant.slug);
  return done();
}

export async function moveCategoryAction(id: string, direction: "up" | "down"): Promise<ActionState> {
  const owned = await getOwnedRestaurant();
  if (!owned.ok) return owned.error;

  const supabase = await createServerSupabase();
  const { data: rows } = await supabase
    .from("categories")
    .select("id, sort_order")
    .eq("restaurant_id", owned.restaurant.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!rows) return fail("Could not reorder.");

  const index = rows.findIndex((r) => r.id === id);
  if (index === -1) return fail("Category not found.");
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= rows.length) return done();

  const reordered = [...rows];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];

  await Promise.all(
    reordered.map((row, i) =>
      supabase
        .from("categories")
        .update({ sort_order: i * 10 })
        .eq("id", row.id)
        .eq("restaurant_id", owned.restaurant.id)
    )
  );

  revalidatePath("/dashboard/categories");
  revalidatePath(`/${owned.restaurant.slug}/menu`);
  return done();
}
