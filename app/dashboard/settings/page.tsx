import type { Metadata } from "next";
import { requireRestaurant } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/Shell";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { ActivationPanel } from "@/components/dashboard/ActivationPanel";
import { AlertsCard } from "@/components/pwa/AlertsCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icons";
import { getPlatformSettings } from "@/lib/platform";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [restaurant, supabase, platform, t] = await Promise.all([
    requireRestaurant(),
    createServerSupabase(),
    getPlatformSettings(),
    getT(),
  ]);

  const { data: settings } = await supabase
    .from("restaurant_settings")
    .select("sound_enabled, show_prices, show_ingredients")
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();

  const rows: Array<[string, string, boolean?]> = [
    [t("settings.planName"), `${platform.brandName} — $${platform.priceUsd} ${t("settings.oneTime")}`, true],
    [
      t("settings.paymentStatus"),
      restaurant.payment_status === "paid" ? t("settings.paid") : t("settings.awaiting"),
    ],
    [t("settings.activated"), formatDate(restaurant.activated_at), true],
    [t("settings.menuLink"), `/${restaurant.slug}/menu`, true],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("settings.title")} description={t("settings.sub")} />

      <ActivationPanel restaurant={restaurant} />

      <SettingsForm
        restaurant={restaurant}
        settings={{
          sound_enabled: settings?.sound_enabled ?? true,
          show_prices: settings?.show_prices ?? true,
          show_ingredients: settings?.show_ingredients ?? true,
        }}
      />

      <AlertsCard />

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
      </Card>
    </div>
  );
}
