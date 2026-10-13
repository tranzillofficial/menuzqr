import { requireBusinessModule } from "@/lib/business-access";
import { createServerSupabase } from "@/lib/supabase/server";
import { OffersManager } from "@/components/dashboard/OffersManager";
import { getLocale } from "@/lib/i18n/server";
import type { BusinessOffer, ProductWithVariants, Category } from "@/lib/types";
export default async function OffersPage() {
  const { restaurant } = await requireBusinessModule("offers");
  const ar = (await getLocale()) === "ar";
  const db = await createServerSupabase();
  const [offers, products, categories] = await Promise.all([
    db
      .from("business_offers")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false }),
    db
      .from("products")
      .select("*,product_variants(*)")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("name")
      .order("id")
      .limit(24),
    db
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order"),
  ]);
  if (offers.error || products.error || categories.error)
    throw Error("Could not load offers");
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold sm:text-2xl">
          {ar ? "العروض" : "Offers"}
        </h1>
        <p className="mt-1 text-xs text-ink-500 sm:text-sm">
          {ar
            ? "أنشئ عروض المنتجات والباكدجات، وحدد مدتها وسعرها."
            : "Create product offers and bundles with a price and schedule."}
        </p>
      </header>
      <OffersManager
        restaurant={restaurant}
        offers={(offers.data ?? []) as BusinessOffer[]}
        products={(products.data ?? []) as ProductWithVariants[]}
        categories={(categories.data ?? []) as Category[]}
      />
    </div>
  );
}
