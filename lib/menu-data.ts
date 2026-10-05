import {getTenantDomain} from "./tenant-domain";
import { withCatalogName } from './menu-localization';
import { moduleEnabled } from "./business-modules";
import { visibleCategories } from "./category-tree";
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
  const domain=await getTenantDomain();
  if(domain&&domain.restaurants.slug!==slug)return {state:"not_found"} as const;
  const supabase = createAdminSupabase();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select(
      "id,business_kind,enabled_modules,name,slug,description,logo_url,cover_url,phone,address,currency,language,menu_theme,ordering_enabled,waiter_calls_enabled,status,owner_id,activation_expires_at,tax_mode,vat_registered,prices_include_vat,tax_rates,menu_prices_include_vat"
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

  restaurant.ordering_enabled = restaurant.ordering_enabled && moduleEnabled(restaurant,"orders");
  restaurant.waiter_calls_enabled = restaurant.waiter_calls_enabled && moduleEnabled(restaurant,"service_calls");
  if (preview) {
    restaurant.ordering_enabled = false;
    restaurant.waiter_calls_enabled = false;
  }
  const [{ data: categories }, { data: products }, {data: payments}] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("products")
      .select("*, product_variants(*)")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("restaurant_settings").select("remote_ordering_enabled,cash_wallet,instapay_address,payment_whatsapp").eq("restaurant_id",restaurant.id).maybeSingle(),
  ]);

  let table: Pick<RestaurantTable, "id" | "label"> | null = null;
  if (tableToken && !preview && moduleEnabled(restaurant,"tables")) {
    const { data } = await supabase
      .from("restaurant_tables")
      .select("id,label")
      .eq("restaurant_id", restaurant.id)
      .eq("qr_token", tableToken)
      .eq("is_active", true)
      .maybeSingle();
    table = data ?? null;
  }

  const itemIds = [...new Set((products ?? []).map(p => p.source_catalog_item_id).filter(Boolean))];
  const categoryIds = [...new Set((categories ?? []).map(c => c.source_catalog_category_id).filter(Boolean))];
  const [catalogItems, catalogCategories] = await Promise.all([
    itemIds.length ? supabase.from('catalog_items').select('id,name,name_en,legacy_name,variants').in('id', itemIds) : Promise.resolve({data: []}),
    categoryIds.length ? supabase.from('catalog_categories').select('id,name,name_en').in('id', categoryIds) : Promise.resolve({data: []}),
  ]);
  const allProducts = ((products ?? []) as ProductWithVariants[]).map((p) => ({
    ...withCatalogName(p, catalogItems.data?.find(item => item.id === p.source_catalog_item_id)),
    product_variants: (p.product_variants ?? [])
      .filter((v) => v.is_active)
      .map(v => {
        const source = catalogItems.data?.find(item => item.id === p.source_catalog_item_id);
        const variants = Array.isArray(source?.variants) ? source.variants as {name:string;name_en?:string}[] : [];
        const matched = variants.find(variant => variant.name === v.name || variant.name_en === v.name);
        const regular = ['Regular','عادي'].includes(v.name) ? {name:'عادي',name_en:'Regular'} : null;
        return { ...withCatalogName(v, matched ?? regular), price: displayPrice(Number(v.price), p.vat_code, restaurant), tax: { basePrice: Number(v.price), rate: vatRate(restaurant.tax_mode,restaurant.vat_registered,p.vat_code,restaurant.tax_rates), inclusive: restaurant.prices_include_vat, showGross: restaurant.menu_prices_include_vat !== false } };
      })
      .sort((a, b) => a.sort_order - b.sort_order || a.price - b.price),
  }));

  const visible = visibleCategories(categories ?? []);
  const grouped = visible.map((category) => ({
    ...withCatalogName(category, catalogCategories.data?.find(source => source.id === category.source_catalog_category_id)),
    products: allProducts.filter((p) => p.category_id === category.id),
  }));

  const uncategorised = allProducts.filter((p) => !p.category_id);
  if (uncategorised.length > 0) {
    grouped.push({
      id: "uncategorised",
      restaurant_id: restaurant.id,
      name: "أصناف أخرى",
      name_en: "More",
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
      menu_path:domain?"/menu":`/${slug}/menu`,
      payments: payments ?? undefined,
      restaurant: { enabled_modules: restaurant.enabled_modules, business_kind: restaurant.business_kind, id: restaurant.id, name: restaurant.name, slug: restaurant.slug, description: restaurant.description, logo_url: restaurant.logo_url, cover_url: restaurant.cover_url, phone: restaurant.phone, address: restaurant.address, currency: restaurant.currency, language: restaurant.language, menu_theme: restaurant.menu_theme, ordering_enabled: restaurant.ordering_enabled, waiter_calls_enabled: restaurant.waiter_calls_enabled, prices_include_vat: restaurant.prices_include_vat, menu_prices_include_vat: restaurant.menu_prices_include_vat, vat_registered: restaurant.vat_registered },
      categories: moduleEnabled(restaurant,"subcategories") ? grouped : grouped.filter((c) => c.products.length > 0),
    },
  };
});
