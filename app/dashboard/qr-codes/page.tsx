import type { Metadata } from "next";
import { requireRestaurant } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/Shell";
import { QrStudio } from "@/components/qr/QrStudio";
import { absoluteUrl } from "@/lib/utils";
import type { QrTemplate, RestaurantTable } from "@/lib/types";

export const metadata: Metadata = { title: "QR Codes" };

export default async function QrCodesPage() {
  const restaurant = await requireRestaurant();
  const supabase = await createServerSupabase();

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
          title="QR Codes"
          description="Print-ready labels for your counter and every table."
        />

        {restaurant.status !== "active" && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Your menu is not activated yet, so these codes show a “menu unavailable” page to
            guests. They start working the moment your account is activated — the codes themselves
            never change, so you can print them now.
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
