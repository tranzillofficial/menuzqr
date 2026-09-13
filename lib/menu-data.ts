import { cache } from "react";
import { createAdminSupabase } from "./supabase/admin";
import type { MenuData, ProductWithVariants, Restaurant, RestaurantTable } from "./types";

export type PublicMenuResult =
  | { state: "not_found" }
  | { state: "inactive"; restaurantName: string; status: Restaurant["status"] }
  | { state: "ok"; data: MenuData; table: Pick<RestaurantTable, "id" | "label"> | null };

/**
 * Loads a public menu by slug.
 *
 * Uses the service-role client on purpose: the activation gate is enforced
 * here, in one place, rather than being spread across RLS + UI. Only menu
 * data for an *active* restaurant is ever returned.
 */
export const getPublicMenu = cache(async function getPublicMenu(
  slug: string,
  tableToken?: string
): Promise<PublicMenuResult> {
  const supabase = createAdminSupabase();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select(
      "id,name,slug,description,logo_url,cover_url,phone,address,currency,language,menu_theme,ordering_enabled,waiter_calls_enabled,status"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!restaurant) return { state: "not_found" };

  if (restaurant.status !== "active") {
    return {
      state: "inactive",
      restaurantName: restaurant.name,
      status: restaurant.status,
    };
  }

  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("products")
      .select("*, product_variants(*)")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  let table: Pick<RestaurantTable, "id" | "label"> | null = null;
  if (tableToken) {
    const { data } = await supabase
      .from("restaurant_tables")
      .select("id,label")
      .eq("restaurant_id", restaurant.id)
      .eq("qr_token", tableToken)
      .eq("is_active", true)
      .maybeSingle();
    table = data ?? null;
  }

  const allProducts = ((products ?? []) as ProductWithVariants[]).map((p) => ({
    ...p,
    product_variants: (p.product_variants ?? [])
      .filter((v) => v.is_active)
      .sort((a, b) => a.sort_order - b.sort_order || a.price - b.price),
  }));

  const grouped = (categories ?? []).map((category) => ({
    ...category,
    products: allProducts.filter((p) => p.category_id === category.id),
  }));

  const uncategorised = allProducts.filter((p) => !p.category_id);
  if (uncategorised.length > 0) {
    grouped.push({
      id: "uncategorised",
      restaurant_id: restaurant.id,
      name: "More",
      description: null,
      image_url: null,
      sort_order: 9999,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      products: uncategorised,
    });
  }

  return {
    state: "ok",
    table,
    data: {
      restaurant,
      categories: grouped.filter((c) => c.products.length > 0),
    },
  };
});
