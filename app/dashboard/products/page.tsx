import { categoryDescendants } from "@/lib/category-tree";
import type { Metadata } from "next";
import { requireManager } from "@/lib/membership";
import { createServerSupabase } from "@/lib/supabase/server";
import { Icon } from "@/components/ui/Icons";
import { getBusinessT as getT } from "@/lib/i18n/server";
import { ProductsManager } from "@/components/dashboard/ProductsManager";
import type { Category, ProductWithVariants } from "@/lib/types";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; category?: string }>;
}) {
  const [membership, supabase, t] = await Promise.all([
    requireManager("/dashboard/products"),
    createServerSupabase(),
    getT(),
  ]);

  const restaurant = membership.restaurant;
  const search = await searchParams;
  const market = restaurant.business_kind === "supermarket";
  const page = Math.min(
    10000,
    Math.max(1, Math.trunc(Number(search.page)) || 1),
  );
  const pageSize = 40;
  const { data: categories, error: categoryError } = await supabase
    .from("categories")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .order("sort_order");
  if (categoryError) throw new Error("Could not load product categories.");
  let productQuery = supabase
    .from("products")
    .select("*, product_variants(*)", { count: market ? "exact" : undefined })
    .eq("restaurant_id", restaurant.id)
    .order("sort_order")
    .order("created_at")
    .order("id");
  if (market) {
    const q = (search.q ?? "")
      .slice(0, 80)
      .replace(/[%,_().\\]/g, " ")
      .trim();
    if (q)
      productQuery = productQuery.or(`name.ilike.%${q}%,barcode.ilike.%${q}%`);
    if (search.category && /^[0-9a-f-]{36}$/i.test(search.category))
      productQuery = productQuery.in("category_id", [
        ...categoryDescendants(
          (categories ?? []) as Category[],
          search.category,
        ),
      ]);
    else if (search.category === "uncategorised")
      productQuery = productQuery.is("category_id", null);
    productQuery = productQuery.range(
      (page - 1) * pageSize,
      page * pageSize - 1,
    );
  }
  const { data: products, error: productError, count } = await productQuery;

  if (categoryError || productError)
    throw new Error("Could not load menu categories and products.");

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-brand-600 ring-1 ring-black/[.04]">
          <Icon.grid className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">
            {t("products.title")}
          </h1>
          <p className="mt-1 text-xs text-ink-500 sm:text-sm">
            {t("products.sub")}
          </p>
        </div>
      </header>
      <ProductsManager
        key={`${page}:${search.q ?? ""}:${search.category ?? "all"}`}
        pagination={
          market
            ? {
                page,
                pageSize,
                total: count ?? 0,
                query: search.q ?? "",
                category: search.category ?? "all",
              }
            : undefined
        }
        restaurant={restaurant}
        categories={(categories ?? []) as Category[]}
        products={(products ?? []) as ProductWithVariants[]}
      />
    </div>
  );
}
