import type { Metadata } from "next";
import { createServerSupabase } from "@/lib/supabase/server";
import { CatalogManager } from "@/components/admin/CatalogManager";
import { Card } from "@/components/ui/Card";
import type { CatalogItem } from "@/lib/types";

export const metadata: Metadata = { title: "Admin — Catalog" };

export default async function AdminCatalogPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("catalog_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const items = ((data ?? []) as CatalogItem[]).map((item) => ({
    ...item,
    variants: Array.isArray(item.variants) ? item.variants : [],
    keywords: Array.isArray(item.keywords) ? item.keywords : [],
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Product catalog</h1>
        <p className="mt-1 text-sm text-ink-500">
          The shared menu every restaurant can pull from.
        </p>
      </div>

      <Card className="border-sky-200 bg-sky-50 p-5">
        <h2 className="text-sm font-semibold text-sky-900">How restaurants see this</h2>
        <p className="mt-1.5 text-sm text-sky-900">
          When an owner starts typing a product name, matching items appear under the field with an
          ⓘ badge. One tap fills in the name, description, ingredients, photo, suggested section and
          sizes — and they can edit all of it before publishing. Prices here are only a starting
          hint; each restaurant sets its own.
        </p>
      </Card>

      <CatalogManager items={items} />
    </div>
  );
}
