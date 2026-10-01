import type { Metadata } from "next";
import { requireManager } from "@/lib/membership";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/Shell";
import { getT } from "@/lib/i18n/server";
import { ProductsManager } from "@/components/dashboard/ProductsManager";
import type { Category, ProductWithVariants } from "@/lib/types";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const [membership, supabase, t] = await Promise.all([
    requireManager("/dashboard/products"),
    createServerSupabase(),
    getT(),
  ]);

  const restaurant = membership.restaurant;
  const [{ data: categories, error: categoryError }, { data: products, error: productError }] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("products")
      .select("*, product_variants(*)")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (categoryError || productError) throw new Error("Could not load menu categories and products.");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t("products.title")}
        description={t("products.sub")}
      />
      <ProductsManager
        restaurant={restaurant}
        categories={(categories ?? []) as Category[]}
        products={(products ?? []) as ProductWithVariants[]}
      />
    </div>
  );
}
