import type { Metadata } from "next";
import { requireRestaurant } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/Shell";
import { CategoriesManager } from "@/components/dashboard/CategoriesManager";
import type { Category } from "@/lib/types";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const restaurant = await requireRestaurant();
  const supabase = await createServerSupabase();

  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("products").select("category_id").eq("restaurant_id", restaurant.id),
  ]);

  const productCounts: Record<string, number> = {};
  for (const product of products ?? []) {
    if (product.category_id) {
      productCounts[product.category_id] = (productCounts[product.category_id] ?? 0) + 1;
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Categories"
        description="The sections of your menu, in the order guests see them."
      />
      <CategoriesManager
        restaurant={restaurant}
        categories={(categories ?? []) as Category[]}
        productCounts={productCounts}
      />
    </div>
  );
}
