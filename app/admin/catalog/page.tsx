import type { Metadata } from "next";
import { createServerSupabase } from "@/lib/supabase/server";
import { CatalogManager } from "@/components/admin/CatalogManager";
import { Card } from "@/components/ui/Card";
import type { CatalogCategory, CatalogItem } from "@/lib/types";

export const metadata: Metadata = { title: "Admin — Shared menu" };

export default async function AdminCatalogPage() {
  const supabase = await createServerSupabase();

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase
      .from("catalog_categories")
      .select("id, name, description, image_url, sort_order, is_active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("catalog_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  const normalised = ((items ?? []) as CatalogItem[]).map((item) => ({
    ...item,
    variants: Array.isArray(item.variants) ? item.variants : [],
    keywords: Array.isArray(item.keywords) ? item.keywords : [],
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">Shared menu</h1>
        <p className="mt-1 text-sm text-ink-500">
          A complete menu — sections, dishes, photos — that any restaurant can copy from.
        </p>
      </div>

      <Card className="border-sky-200 bg-sky-50 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-sky-900">How restaurants use this</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-sky-900">
          <li>
            <strong>Browse and copy.</strong> At <code>/dashboard/catalog</code> an owner ticks the
            dishes they want and copies them into their own menu — sections, photos, descriptions
            and sizes included. Everything copied is theirs to rename, reprice or delete.
          </li>
          <li>
            <strong>Type-ahead.</strong> While adding a product by hand, matching dishes still
            appear under the name field with an ⓘ badge.
          </li>
          <li>
            <strong>Photos are shared, not duplicated.</strong> A copied dish points at the same
            optimised image, so one photo serves every restaurant that uses it.
          </li>
        </ul>
      </Card>

      <CatalogManager
        categories={(categories ?? []) as CatalogCategory[]}
        items={normalised}
      />
    </div>
  );
}
