"use server";

import { moduleEnabled } from "@/lib/business-modules";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import {
  bool,
  deleteAssetIfOwned,
  done,
  fail,
  getMenuRestaurant,
  optionalStr,
  sanitiseImageUrl,
  str,
} from "./helpers";

function revalidate(slug: string) {
  revalidatePath("/dashboard/categories");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
  revalidatePath(`/${slug}/menu`);
}

export async function saveCategoryAction(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const owned = await getMenuRestaurant();
  if (!owned.ok) return owned.error;
  const { restaurant } = owned;

  const id = str(form, "id");
  const name = str(form, "name");
  if (!name) return fail("Category name is required.", { name: "Required." });

  const supabase = await createServerSupabase();
  const imageUrl = sanitiseImageUrl(optionalStr(form, "image_url"));

  const payload = {
    restaurant_id: restaurant.id,
    name,
    ...(moduleEnabled(restaurant,"subcategories") ? {parent_id: optionalStr(form,"parent_id")} : {}),
    description: optionalStr(form, "description"),
    image_url: imageUrl,
    is_active: bool(form, "is_active"),
  };

  if (id) {
    const { data: current } = await supabase
      .from("categories")
      .select("image_url")
      .eq("id", id)
      .eq("restaurant_id", restaurant.id)
      .maybeSingle();

    const { error } = await supabase
      .from("categories")
      .update(payload)
      .eq("id", id)
      .eq("restaurant_id", restaurant.id);
    if (error) return fail(error.message);

    if (current?.image_url && current.image_url !== imageUrl) {
      await deleteAssetIfOwned(current.image_url, restaurant.id);
    }
  } else {
    const { count } = await supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id);

    const { error } = await supabase
      .from("categories")
      .insert({ ...payload, sort_order: (count ?? 0) * 10 });
    if (error) return fail(error.message);
  }

  revalidate(restaurant.slug);
  return done(id ? "Category updated." : "Category added.");
}

/**
 * Creates one category and returns it, so the product editor can add a missing
 * section inline without the owner losing the form they were filling in.
 */
export async function createCategoryQuickAction(
  name: string, sourceId?: string
): Promise<{ ok: boolean; message?: string; category?: { id: string; name: string; source_catalog_category_id?: string | null } }> {
  const owned = await getMenuRestaurant();
  if (!owned.ok) return { ok: false, message: owned.error?.message };

  let clean = name.trim().slice(0, 60);
  if (!clean) return { ok: false, message: "Enter a category name." };

  const supabase = await createServerSupabase();

  if (sourceId && !moduleEnabled(owned.restaurant,"catalog")) return {ok:false,message:"Catalog is disabled for this account."};
  if (sourceId) {
    const {data:source,error:sourceError} = await supabase.from("catalog_categories").select("id,name").eq("id",sourceId).eq("is_active",true).maybeSingle();
    if (sourceError || !source) return {ok:false,message:"That catalog section is no longer available."};
    clean = source.name.trim().slice(0,60);
    const {data:linked,error:linkedError} = await supabase.from("categories").select("id,name").eq("restaurant_id",owned.restaurant.id).eq("source_catalog_category_id",source.id).maybeSingle();
    if (linkedError) return {ok:false,message:linkedError.message};
    if (linked) return {ok:true,category:linked};
  }

  // Escape LIKE metacharacters: "50% off" must not match "50 percent off".
  // .limit(1) because two rows differing only in case would make maybeSingle throw.
  const pattern = clean.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  const { data: matches, error: readError } = await supabase
    .from("categories")
    .select("id, name, source_catalog_category_id")
    .eq("restaurant_id", owned.restaurant.id)
    .ilike("name", pattern)
    .limit(1);

  if (readError) return {ok:false,message:readError.message};
  const existing = matches?.[0];

  if (existing) {
    if (sourceId && !existing.source_catalog_category_id) {
      const {error} = await supabase.from("categories").update({source_catalog_category_id:sourceId}).eq("id",existing.id).eq("restaurant_id",owned.restaurant.id).is("source_catalog_category_id",null);
      if (error) return {ok:false,message:error.message};
      revalidate(owned.restaurant.slug);
      existing.source_catalog_category_id=sourceId;
    }
    return { ok: true, message: `"${existing.name}" already exists.`, category: existing };
  }

  const { count } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", owned.restaurant.id);

  const { data, error } = await supabase
    .from("categories")
    .insert({
      restaurant_id: owned.restaurant.id,
      name: clean,
      ...(sourceId ? {source_catalog_category_id:sourceId} : {}),
      sort_order: (count ?? 0) * 10,
    })
    .select("id, name, source_catalog_category_id")
    .single();

  if (error || !data) return { ok: false, message: error?.message ?? "Could not add the category." };

  revalidate(owned.restaurant.slug);
  return { ok: true, message: `"${data.name}" added.`, category: data };
}

export async function deleteCategoryAction(id: string): Promise<ActionState> {
  const owned = await getMenuRestaurant();
  if (!owned.ok) return owned.error;

  const supabase = await createServerSupabase();
  const { data: current } = await supabase
    .from("categories")
    .select("image_url")
    .eq("id", id)
    .eq("restaurant_id", owned.restaurant.id)
    .maybeSingle();

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", owned.restaurant.id);
  if (error) return fail(error.message);

  await deleteAssetIfOwned(current?.image_url, owned.restaurant.id);
  revalidate(owned.restaurant.slug);
  return done("Category deleted. Its products were kept and are now uncategorised.");
}

export async function toggleCategoryAction(id: string, isActive: boolean): Promise<ActionState> {
  const owned = await getMenuRestaurant();
  if (!owned.ok) return owned.error;

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("categories")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("restaurant_id", owned.restaurant.id);
  if (error) return fail(error.message);

  revalidate(owned.restaurant.slug);
  return done(isActive ? "Category is visible." : "Category hidden from the menu.");
}

/** Persists a full ordering. `ids` must be the complete list in its new order. */
export async function reorderCategoriesAction(ids: string[]): Promise<ActionState> {
  const owned = await getMenuRestaurant();
  if (!owned.ok) return owned.error;

  const supabase = await createServerSupabase();
  const results = await Promise.all(
    ids.map((id, index) =>
      supabase
        .from("categories")
        .update({ sort_order: index * 10 })
        .eq("id", id)
        .eq("restaurant_id", owned.restaurant.id)
    )
  );
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) return fail(firstError.message);

  revalidate(owned.restaurant.slug);
  return done();
}

/** Reorder helper kept server-side so the sort_order stays consistent. */
export async function reorderProductsAction(ids: string[]): Promise<ActionState> {
  const owned = await getMenuRestaurant();
  if (!owned.ok) return owned.error;

  const supabase = await createServerSupabase();
  const results = await Promise.all(
    ids.map((id, index) =>
      supabase
        .from("products")
        .update({ sort_order: index * 10 })
        .eq("id", id)
        .eq("restaurant_id", owned.restaurant.id)
    )
  );
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) return fail(firstError.message);

  revalidate(owned.restaurant.slug);
  return done();
}
