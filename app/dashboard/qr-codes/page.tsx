import { qrTemplateAvailable } from "@/lib/qr-template-access";
import { featureEnabled } from "@/lib/business-features";
import { requireBusinessModule } from "@/lib/business-access";
import type { QrPreferences } from "@/lib/qr-preferences";
import type { Metadata } from "next";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/Shell";
import { getBusinessT as getT } from "@/lib/i18n/server";
import { QrStudio } from "@/components/qr/QrStudio";
import { businessMenuUrl } from "@/lib/tenant-domain";
import type { QrTemplate, RestaurantTable } from "@/lib/types";

export const metadata: Metadata = { title: "QR Codes" };

export default async function QrCodesPage() {
  const [member, supabase, t] = await Promise.all([
    requireBusinessModule("qr"),
    createServerSupabase(),
    getT(),
  ]);

  const restaurant = member.restaurant;
  const [{ data: tables }, { data: templates }] = await Promise.all([
    featureEnabled(restaurant, "qr_tables")
      ? supabase
          .from("restaurant_tables")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase
      .from("qr_templates")
      .select("*")
      .eq("is_active", true)
      .or(`allowed_restaurant_ids.is.null,allowed_restaurant_ids.cs.{${restaurant.id}}`)
      .order("sort_order", { ascending: true }),
  ]);

  const { data: whatsappSettings } = await supabase
    .from("restaurant_settings")
    .select("payment_whatsapp")
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();
  const { data: qrSettings, error: qrError } = await supabase
    .from("business_qr_settings")
    .select("preferences")
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();
  if (qrError) throw Error("Could not load QR preferences");
  const whatsapp = whatsappSettings?.payment_whatsapp ?? "";

  return (
    <div className="print-sheet mx-auto max-w-6xl">
      <div className="print-hide">
        <PageHeader title={t("qr.title")} description={t("qr.sub")} />

        {restaurant.status !== "active" && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            {t("qr.notActiveNote")}
          </div>
        )}
      </div>

      <QrStudio
        preferences={(qrSettings?.preferences ?? {}) as QrPreferences}
        whatsapp={whatsapp}
        restaurant={restaurant}
        tables={(tables ?? []) as RestaurantTable[]}
        templates={((templates ?? []) as QrTemplate[]).filter(template=>qrTemplateAvailable(template,restaurant.id))}
        generalUrl={await businessMenuUrl(restaurant)}
      />
    </div>
  );
}
