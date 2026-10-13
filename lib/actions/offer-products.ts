"use server";
import { getMenuRestaurant } from "./helpers";
import { createServerSupabase } from "@/lib/supabase/server";
import { featureEnabled } from "@/lib/business-features";
import { categoryDescendants } from "@/lib/category-tree";
import type { ProductWithVariants } from "@/lib/types";
export async function searchOfferProducts(
  query: string,
  category = "",
  barcodeOnly = false,
) {
  const owned = await getMenuRestaurant("offers");
  if (!owned.ok)
    return { ok: false as const, message: "Offer access unavailable." };
  if (
    barcodeOnly &&
    (!featureEnabled(owned.restaurant, "offer_barcode_scan") ||
      !featureEnabled(owned.restaurant, "product_barcode"))
  )
    return { ok: false as const, message: "Barcode scanning disabled." };
  const db = await createServerSupabase();
  let request = db
    .from("products")
    .select("*,product_variants(*)")
    .eq("restaurant_id", owned.restaurant.id)
    .eq("is_active", true);
  const q = String(query)
    .slice(0, 100)
    .replace(/[%,_().\\]/g, " ")
    .trim();
  if (barcodeOnly) request = request.eq("barcode", q);
  else if (q) request = request.or(`name.ilike.%${q}%,barcode.ilike.%${q}%`);
  if (category) {
    const cats = await db
      .from("categories")
      .select("id,name,parent_id")
      .eq("restaurant_id", owned.restaurant.id);
    if (cats.error)
      return { ok: false as const, message: "Could not load categories." };
    request = request.in("category_id", [
      ...categoryDescendants(cats.data ?? [], category),
    ]);
  }
  const { data, error } = await request.order("name").order("id").limit(25);
  if (error) return { ok: false as const, message: "Could not load products." };
  return {
    ok: true as const,
    products: (data ?? []) as ProductWithVariants[],
    hasMore: (data ?? []).length > 24,
  };
}
