import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/Shell";
import { PlansPanel } from "@/components/dashboard/PlansPanel";
import { requireManager } from "@/lib/membership";
import { getPlatformSettings } from "@/lib/platform";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Plans" };

export default async function BillingPage() {
  const [membership, platform, t] = await Promise.all([
    requireManager("/dashboard/billing"),
    getPlatformSettings(),
    getT(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("plans.title")} description={t("plans.sub")} />
      <PlansPanel
        restaurant={membership.restaurant}
        menuPrice={platform.priceUsd}
        menuBundlePrice={platform.menuBundleUsd}
        posMonthly={platform.posMonthlyUsd}
        posYearly={platform.posYearlyUsd}
        posEnabled={platform.posEnabled}
        whatsappUrl={platform.supportWhatsappUrl}
        whatsappDisplay={platform.supportWhatsappDisplay}
      />
    </div>
  );
}
