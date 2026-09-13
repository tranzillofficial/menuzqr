import type { Metadata } from "next";
import { requireRestaurant } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/Shell";
import { getT } from "@/lib/i18n/server";
import { QrStudio } from "@/components/qr/QrStudio";
import { absoluteUrl } from "@/lib/utils";
import type { QrTemplate, RestaurantTable } from "@/lib/types";

export const metadata: Metadata = { title: "QR Codes" };

export default async function QrCodesPage() {
  const [restaurant, supabase, t] = await Promise.all([
    requireRestaurant(),
    createServerSupabase(),
    getT(),
  ]);

  const [{ data: tables }, { data: templates }] = await Promise.all([
    supabase
      .from("restaurant_tables")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("qr_templates")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <div className="print-sheet mx-auto max-w-5xl">
      <div className="print-hide">
        <PageHeader
          title={t("qr.title")}
          description={t("qr.sub")}
        />

        {restaurant.status !== "active" && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            {t("qr.notActiveNote")}
          </div>
        )}
      </div>

      <QrStudio
        restaurant={restaurant}
        tables={(tables ?? []) as RestaurantTable[]}
        templates={(templates ?? []) as QrTemplate[]}
        generalUrl={absoluteUrl(`/${restaurant.slug}/menu`)}
      />
    </div>
  );
}
