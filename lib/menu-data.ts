import { displayPrice, vatRate } from "./tax";
import { getUser } from "./auth";
import { cache } from "react";
import { createAdminSupabase } from "./supabase/admin";
import type { MenuData, ProductWithVariants, Restaurant, RestaurantTable } from "./types";

export type PublicMenuResult =
  | { state: "not_found" }
  | {
      state: "inactive";
      restaurantName: string;
      status: Restaurant["status"];
      language: string;
    }
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
      "id,name,slug,description,logo_url,cover_url,phone,address,currency,language,menu_theme,ordering_enabled,waiter_calls_enabled,status,owner_id,activation_expires_at,tax_mode,vat_registered,prices_include_vat"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!restaurant) return { state: "not_found" };

  const expired = restaurant.activation_expires_at && new Date(restaurant.activation_expires_at) <= new Date();
  const preview = restaurant.status !== "active" || Boolean(expired);
  const user = preview ? await getUser() : null;
  if (preview && user?.id !== restaurant.owner_id) {
    return {
      state: "inactive",
      restaurantName: restaurant.name,
      status: restaurant.status,
      language: restaurant.language,
    };
  }

  if (preview) {
    restaurant.ordering_enabled = false;
    restaurant.waiter_calls_enabled = false;
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
  if (tableToken && !preview) {
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
      .map(v => ({ ...v, price: displayPrice(Number(v.price), p.vat_code, restaurant), tax: { basePrice: Number(v.price), rate: vatRate(restaurant.tax_mode,restaurant.vat_registered,p.vat_code), inclusive: restaurant.prices_include_vat } }))
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
      restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug, description: restaurant.description, logo_url: restaurant.logo_url, cover_url: restaurant.cover_url, phone: restaurant.phone, address: restaurant.address, currency: restaurant.currency, language: restaurant.language, menu_theme: restaurant.menu_theme, ordering_enabled: restaurant.ordering_enabled, waiter_calls_enabled: restaurant.waiter_calls_enabled },
      categories: grouped.filter((c) => c.products.length > 0),
    },
  };
});
