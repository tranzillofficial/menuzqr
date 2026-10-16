import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/Shell";
import { CatalogBrowser } from "@/components/dashboard/CatalogBrowser";
import { requireManager } from "@/lib/membership";
import { createServerSupabase } from "@/lib/supabase/server";
import { getBusinessT as getT } from "@/lib/i18n/server";
import type { CatalogCategory, CatalogItem } from "@/lib/types";
import Link from 'next/link';
import {SupermarketCatalogBrowser} from '@/components/dashboard/SupermarketCatalogBrowser';

export const metadata: Metadata = { title: "Ready-made menu" };

export default async function DashboardCatalogPage({searchParams}:{searchParams:Promise<{catalog?:string}>}) {
  const [membership, supabase, t] = await Promise.all([
    requireManager("/dashboard/catalog"),
    createServerSupabase(),
    getT(),
  ]);

  const params=await searchParams;
  const supermarket=params.catalog==='supermarket'||(!params.catalog&&['supermarket','market'].includes(membership.restaurant.business_kind??''));
  if(supermarket)return <div className="mx-auto max-w-5xl"><PageHeader title={t('catalog.title')} description={t('catalog.sub')}/><SupermarketCatalogBrowser currency={membership.restaurant.currency}/></div>;

  const [{ data: categories, error: categoryError }, { data: items, error: itemError }] = await Promise.all([
    supabase
      .from("catalog_categories")
      .select("id, name, name_en, business_types, description, image_url, sort_order, is_active")
      .is("merged_into_id", null)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("catalog_items")
      .select("*")
      .is("merged_into_id", null)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (categoryError || itemError) throw new Error("Could not load the ready-made menu.");
  const activeSections = new Set((categories ?? []).map(c => c.id));

  const normalised = ((items ?? []) as CatalogItem[]).filter(item => !item.category_id || activeSections.has(item.category_id)).map((item) => ({
    ...item,
    variants: Array.isArray(item.variants) ? item.variants : [],
    keywords: Array.isArray(item.keywords) ? item.keywords : [],
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("catalog.title")} description={t("catalog.sub")} />
      <Link href="/dashboard/catalog?catalog=supermarket" className="mb-3 inline-flex rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">Supermarket · منتجات السوبر ماركت</Link>
      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {t("catalog.draftNotice")}
      </div>
      <CatalogBrowser
        categories={(categories ?? []) as CatalogCategory[]}
        items={normalised}
        currency={membership.restaurant.currency}
      />
    </div>
  );
}
