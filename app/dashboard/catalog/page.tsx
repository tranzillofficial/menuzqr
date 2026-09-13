import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/Shell";
import { CatalogBrowser } from "@/components/dashboard/CatalogBrowser";
import { requireManager } from "@/lib/membership";
import { createServerSupabase } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import type { CatalogCategory, CatalogItem } from "@/lib/types";

export const metadata: Metadata = { title: "Ready-made menu" };

export default async function DashboardCatalogPage() {
  const [, supabase, t] = await Promise.all([
    requireManager("/dashboard/catalog"),
    createServerSupabase(),
    getT(),
  ]);

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase
      .from("catalog_categories")
      .select("id, name, description, image_url, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("catalog_items")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  const normalised = ((items ?? []) as CatalogItem[]).map((item) => ({
    ...item,
    variants: Array.isArray(item.variants) ? item.variants : [],
    keywords: Array.isArray(item.keywords) ? item.keywords : [],
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("catalog.title")} description={t("catalog.sub")} />
      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {t("catalog.draftNotice")}
      </div>
      <CatalogBrowser
        categories={(categories ?? []) as CatalogCategory[]}
        items={normalised}
      />
    </div>
  );
}
