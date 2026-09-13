import type { Metadata } from "next";
import { requireRestaurant } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/Shell";
import { ProductsManager } from "@/components/dashboard/ProductsManager";
import type { Category, ProductWithVariants } from "@/lib/types";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const restaurant = await requireRestaurant();
  const supabase = await createServerSupabase();

  const [{ data: categories }, { data: products }] = await Promise.all([
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

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Products"
        description="Everything on your menu, with sizes and prices."
      />
      <ProductsManager
        restaurant={restaurant}
        categories={(categories ?? []) as Category[]}
        products={(products ?? []) as ProductWithVariants[]}
      />
    </div>
  );
}
