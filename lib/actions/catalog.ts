"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import type { CatalogItem } from "@/lib/types";
import { getOwnedRestaurant, sanitiseImageUrl } from "./helpers";

const MAX_IMPORT = 60;
const MAX_NAME = 90;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ImportResult = {
  ok: boolean;
  message?: string;
  /** Products created, as drafts. */
  added?: number;
  /** Skipped because the restaurant already has a product with that name. */
  skipped?: number;
  /** Sections created along the way. */
  sections?: number;
};

type CatalogRow = Pick<
  CatalogItem,
  "id" | "name" | "description" | "ingredients" | "image_url" | "variants" | "category_id" | "category_name"
> & {
  catalog_categories: { id: string; name: string } | { id: string; name: string }[] | null;
};

/**
 * Copies dishes from the shared menu into the signed-in owner's own menu.
 *
 * A copy, not a link: every product, variant and section becomes theirs to
 * rename, reprice or delete, and later edits to the shared menu never reach
 * back into a restaurant that has already copied from it.
 *
 * Copies arrive HIDDEN. The shared menu's prices are a starting hint and can
 * be zero, and publishing a free item onto a live QR menu because someone
 * ticked a box is not a mistake worth allowing. The owner prices them, then
 * switches them on.
 *
 * The photo is the one thing that stays shared — it is a public library URL,
 * exactly like picking an image from the library by hand, so a thousand
 * restaurants using the same burger photo store it once.
 *
 * Runs as the signed-in user, not the service role: RLS is a second gate
 * behind the ownership check, the same way every other owner action works.
 */
export async function importCatalogItemsAction(itemIds: string[]): Promise<ImportResult> {
  const owned = await getOwnedRestaurant();
  if (!owned.ok) return { ok: false, message: owned.error?.message ?? "Sign in first." };

  const ids = [...new Set((itemIds ?? []).filter((id) => typeof id === "string" && UUID.test(id)))];
  if (ids.length === 0) return { ok: false, message: "Pick at least one dish." };
  if (ids.length > MAX_IMPORT) {
    return { ok: false, message: `You can copy up to ${MAX_IMPORT} dishes at a time.` };
  }

  const restaurantId = owned.restaurant.id;
  const supabase = await createServerSupabase();

  const { data: rawItems, error: readError } = await supabase
    .from("catalog_items")
    .select(
      "id, name, description, ingredients, image_url, variants, category_id, category_name, catalog_categories(id, name)"
    )
    .in("id", ids)
    .eq("is_active", true);

  if (readError) return { ok: false, message: readError.message };

  // A dish whose section is switched off must not come across. RLS hides the
  // category row, so the embed comes back null while `category_id` is still
  // set — that mismatch is exactly how a hidden section is detected.
  const items = ((rawItems ?? []) as CatalogRow[]).filter((item) => {
    if (!item.category_id) return true;
    const joined = item.catalog_categories;
    return Boolean(Array.isArray(joined) ? joined[0] : joined);
  });

  if (items.length === 0) return { ok: false, message: "Those dishes are no longer available." };

  // --- what the restaurant already has, so nothing is duplicated ---------
  const [
    { data: existingCategories, error: categoryError },
    { data: existingProducts, error: productReadError },
  ] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .limit(500),
    supabase.from("products").select("name").eq("restaurant_id", restaurantId).limit(2000),
  ]);

  // Proceeding on a partial read would duplicate the owner's whole menu.
  if (categoryError || productReadError) {
    return { ok: false, message: "Could not read your menu. Please try again." };
  }

  const categoryByName = new Map<string, string>(
    (existingCategories ?? []).map((row) => [normalise(row.name as string), row.id as string])
  );
  const takenNames = new Set((existingProducts ?? []).map((row) => normalise(row.name as string)));

  // --- plan the copy before writing anything ----------------------------
  type Planned = {
    name: string;
    sectionName: string | null;
    description: string | null;
    ingredients: string | null;
    image: string | null;
    variants: Array<{ name: string; price: number }>;
  };

  const planned: Planned[] = [];
  const missingSections = new Map<string, string>(); // normalised -> display name
  let skipped = 0;

  for (const item of items) {
    // Dedup on the stored name, which is what actually lands in the table.
    const name = item.name.slice(0, MAX_NAME);
    const key = normalise(name);
    if (takenNames.has(key)) {
      skipped += 1;
      continue;
    }
    takenNames.add(key);

    const joined = item.catalog_categories;
    const category = (Array.isArray(joined) ? joined[0] : joined) ?? null;
    const sectionName = (category?.name ?? item.category_name ?? "").trim().slice(0, 60) || null;

    if (sectionName) {
      const sectionKey = normalise(sectionName);
      if (!categoryByName.has(sectionKey)) missingSections.set(sectionKey, sectionName);
    }

    planned.push({
      name,
      sectionName,
      description: item.description?.slice(0, 400) ?? null,
      ingredients: item.ingredients?.slice(0, 300) ?? null,
      image: sanitiseImageUrl(item.image_url),
      variants: readVariants(item.variants),
    });
  }

  if (planned.length === 0) {
    return {
      ok: true,
      added: 0,
      skipped,
      sections: 0,
      message: "Everything you picked is already on your menu.",
    };
  }

  // --- create the missing sections, in one round trip -------------------
  const createdSectionIds: string[] = [];

  if (missingSections.size > 0) {
    const { data: lastCategory } = await supabase
      .from("categories")
      .select("sort_order")
      .eq("restaurant_id", restaurantId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    let order = (Number(lastCategory?.sort_order) || 0) + 1;

    const { data: createdSections, error: sectionError } = await supabase
      .from("categories")
      .insert(
        [...missingSections.values()].map((name) => ({
          restaurant_id: restaurantId,
          name,
          sort_order: order++,
        }))
      )
      .select("id, name");

    if (sectionError || !createdSections) {
      return { ok: false, message: sectionError?.message ?? "Could not create the sections." };
    }

    for (const row of createdSections) {
      categoryByName.set(normalise(row.name as string), row.id as string);
      createdSectionIds.push(row.id as string);
    }
  }

  // --- create the products ----------------------------------------------
  const { data: lastProduct } = await supabase
    .from("products")
    .select("sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let productOrder = (Number(lastProduct?.sort_order) || 0) + 1;

  const { data: inserted, error: productError } = await supabase
    .from("products")
    .insert(
      planned.map((entry) => ({
        restaurant_id: restaurantId,
        category_id: entry.sectionName
          ? (categoryByName.get(normalise(entry.sectionName)) ?? null)
          : null,
        name: entry.name,
        description: entry.description,
        ingredients: entry.ingredients,
        image_url: entry.image,
        image_source: entry.image ? "library" : "none",
        sort_order: productOrder++,
        // Hidden until the owner has set real prices — see the note above.
        is_active: false,
      }))
    )
    .select("id, name");

  if (productError || !inserted) {
    await rollbackSections(supabase, createdSectionIds);
    return { ok: false, message: productError?.message ?? "Could not copy those dishes." };
  }

  // --- and their prices --------------------------------------------------
  // Matched by name, not by array position: `insert ... returning` is not
  // promised to come back in input order, and getting this wrong would put
  // one dish's prices on another. Names are unique within the batch because
  // the dedup above runs on the same truncated, normalised value.
  const variantsByName = new Map(planned.map((entry) => [normalise(entry.name), entry.variants]));

  const variantRows = inserted.flatMap((row) => {
    const variants = variantsByName.get(normalise(row.name as string)) ?? [];
    const list = variants.length > 0 ? variants : [{ name: "Regular", price: 0 }];
    return list.map((variant, position) => ({
      restaurant_id: restaurantId,
      product_id: row.id as string,
      name: variant.name.slice(0, 40),
      price: variant.price,
      sort_order: position,
      is_active: true,
    }));
  });

  const { error: variantError } = await supabase.from("product_variants").insert(variantRows);

  if (variantError) {
    // Leave nothing half-copied: the products and any section created for them.
    await supabase
      .from("products")
      .delete()
      .in(
        "id",
        inserted.map((row) => row.id)
      );
    await rollbackSections(supabase, createdSectionIds);
    return { ok: false, message: "Could not copy the sizes. Nothing was added." };
  }

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/categories");
  revalidatePath("/dashboard");
  revalidatePath(`/${owned.restaurant.slug}/menu`);

  return {
    ok: true,
    added: inserted.length,
    skipped,
    sections: createdSectionIds.length,
  };
}

type Client = Awaited<ReturnType<typeof createServerSupabase>>;

/** Removes sections this import created. They are empty by definition. */
async function rollbackSections(supabase: Client, ids: string[]) {
  if (ids.length === 0) return;
  await supabase.from("categories").delete().in("id", ids);
}

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function readVariants(raw: CatalogItem["variants"]): Array<{ name: string; price: number }> {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((variant) => ({
      name: String(variant?.name ?? "").trim() || "Regular",
      price: Math.max(0, Math.round((Number(variant?.price) || 0) * 100) / 100),
    }))
    .slice(0, 8);
}
