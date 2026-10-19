import {getBusinessBrandName,businessMenuUrl} from "@/lib/tenant-domain";
import {featureEnabled} from "@/lib/business-features";
import { moduleEnabled } from "@/lib/business-modules";
import { ThermalPrinter } from "@/components/dashboard/ThermalPrinter";
import { InvoiceExport } from "@/components/dashboard/InvoiceExport";
import { TaxSettingsForm } from "@/components/dashboard/TaxSettingsForm";
import type { Metadata } from "next";
import { requireRestaurant } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { ActivationPanel } from "@/components/dashboard/ActivationPanel";
import { AlertsCard } from "@/components/pwa/AlertsCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icons";
import { getPlatformSettings } from "@/lib/platform";
import {getLocale} from "@/lib/i18n/server";
import { getBusinessT as getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [restaurant, supabase, platform, t] = await Promise.all([
    requireRestaurant(),
    createServerSupabase(),
    getPlatformSettings(),
    getT(),
  ]);

  const {count: tableCount,error:tableError}=moduleEnabled(restaurant,"tables") ? await supabase.from("restaurant_tables").select("id",{count:"exact",head:true}).eq("restaurant_id",restaurant.id).eq("is_active",true) : {count:0,error:null};
  if(tableError)throw new Error("Could not load table settings");
  const ar=(await getLocale())==="ar";
  const hasTables=(tableCount??0)>0;

  const { data: settings } = await supabase
    .from("restaurant_settings")
    .select("sound_enabled, show_prices, show_ingredients,remote_ordering_enabled,cash_wallet,instapay_address,payment_whatsapp,delivery_fee,free_delivery_above,payment_details,location_url,facebook_url,instagram_url,website_url,whatsapp_url,tiktok_url")
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();

  const rows: Array<[string, string, boolean?]> = [
    [
      t("settings.planName"),
      `${(await getBusinessBrandName(restaurant.id))??platform.brandName}. $${
        restaurant.pos_status === "active" ? platform.menuBundleUsd : platform.priceUsd
      } ${t("settings.oneTime")}`,
      true,
    ],
    [
      t("settings.paymentStatus"),
      restaurant.payment_status === "paid" ? t("settings.paid") : t("settings.awaiting"),
    ],
    [t("settings.activated"), formatDate(restaurant.activated_at), true],
    [t("settings.menuLink"), await businessMenuUrl(restaurant), true],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon.settings className="size-5"/></span><div><h1 className="text-xl font-semibold sm:text-2xl">{t("settings.title")}</h1><p className="mt-1 text-xs text-ink-500 sm:text-sm">{t("settings.sub")}</p></div></header>

      <SettingsForm restaurant={restaurant} hasTables={hasTables} settings={{...settings,sound_enabled:settings?.sound_enabled??true,show_prices:settings?.show_prices??true,show_ingredients:settings?.show_ingredients??true}} sections={[
        ...(moduleEnabled(restaurant,"qr")&&featureEnabled(restaurant,"qr_whatsapp")?[{id:"whatsapp",ar:"واتساب وQR",en:"WhatsApp & QR",content:<section className="rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5"><h2 className="text-sm font-semibold">{ar?"واتساب وQR":"WhatsApp & QR"}</h2><p className="mt-2 text-xs text-ink-500">{settings?.payment_whatsapp?`+${settings.payment_whatsapp}`:(ar?"احفظ رقم واتساب في معلومات الدفع أولًا.":"Add WhatsApp in payment information first.")}</p><a href="/dashboard/qr-codes" className="mt-4 inline-flex rounded-xl bg-brand-600 px-4 py-3 text-xs font-semibold text-white">{ar?"تصميم وتحميل أكواد QR":"Design and export QR"}</a></section>}]:[]),
        ...(featureEnabled(restaurant,"tax_settings")?[{id:"tax",ar:"الضرائب",en:"Taxes",content:<TaxSettingsForm restaurant={restaurant}/>}]:[]),
        ...(featureEnabled(restaurant,"receipt_printing")?[{id:"print",ar:"الطباعة",en:"Printing",content:<ThermalPrinter restaurantId={restaurant.id} restaurantName={restaurant.name} currency={restaurant.currency} receipt={null}/>}]:[]),
        ...(moduleEnabled(restaurant,"invoices")?[{id:"invoices",ar:"الفواتير والتصدير",en:"Invoices and export",content:<InvoiceExport/>}]:[]),
        {id:"alerts",ar:"التنبيهات",en:"Notifications",content:<AlertsCard/>},
        {id:"account",ar:"الحساب والاشتراك",en:"Account and subscription",content:(<><ActivationPanel restaurant={restaurant}/>
      <Card>
        <CardHeader title={t("settings.plan")} />
        <dl className="divide-y divide-ink-100 text-sm">
          {rows.map(([label, value, ltr]) => (
            <div key={label} className="flex justify-between gap-4 px-5 py-3">
              <dt className="text-ink-500">{label}</dt>
              <dd className={`text-end font-medium text-ink-900 ${ltr ? "ltr-nums" : ""}`}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-ink-100 px-5 py-4">
          <p className="text-sm text-ink-600">{t("settings.billingNote")}</p>
          <a
            href={platform.supportWhatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white hover:brightness-95"
          >
            <Icon.whatsapp className="size-4" />
            <span className="ltr-nums">{platform.supportWhatsappDisplay}</span>
          </a>
        </div>
      </Card></>)},
      ]}/>
    </div>
  );
}
