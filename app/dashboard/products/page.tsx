import type { Metadata } from "next";
import { requireManager } from "@/lib/membership";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/Shell";
import { getBusinessT as getT } from "@/lib/i18n/server";
import { ProductsManager } from "@/components/dashboard/ProductsManager";
import type { Category, ProductWithVariants } from "@/lib/types";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({searchParams}:{searchParams:Promise<{page?:string;q?:string;category?:string}>}) {
  const [membership, supabase, t] = await Promise.all([
    requireManager("/dashboard/products"),
    createServerSupabase(),
    getT(),
  ]);

  const restaurant = membership.restaurant;const search=await searchParams;const market=restaurant.business_kind==='supermarket';const page=Math.min(10000,Math.max(1,Math.trunc(Number(search.page))||1));const pageSize=40;
  let productQuery=supabase.from('products').select('*, product_variants(*)',{count:market?'exact':undefined}).eq('restaurant_id',restaurant.id).order('sort_order').order('created_at').order('id');
  if(market){const q=(search.q??'').slice(0,80).replace(/[%,_().\\]/g,' ').trim();if(q)productQuery=productQuery.or(`name.ilike.%${q}%,barcode.ilike.%${q}%`);if(search.category&&/^[0-9a-f-]{36}$/i.test(search.category))productQuery=productQuery.eq('category_id',search.category);else if(search.category==='uncategorised')productQuery=productQuery.is('category_id',null);productQuery=productQuery.range((page-1)*pageSize,page*pageSize-1);}

  const [{ data: categories, error: categoryError }, { data: products, error: productError,count }] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order", { ascending: true }),
    productQuery,
  ]);

  if (categoryError || productError) throw new Error("Could not load menu categories and products.");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t("products.title")}
        description={t("products.sub")}
      />
      <ProductsManager
        pagination={market?{page,pageSize,total:count??0,query:search.q??"",category:search.category??"all"}:undefined}
        restaurant={restaurant}
        categories={(categories ?? []) as Category[]}
        products={(products ?? []) as ProductWithVariants[]}
      />
    </div>
  );
}
