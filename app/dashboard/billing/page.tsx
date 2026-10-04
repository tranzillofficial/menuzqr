import { localizedPricing } from "@/lib/pricing";
import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/Shell";
import { PlansPanel } from "@/components/dashboard/PlansPanel";
import { requireManager } from "@/lib/membership";
import { getPlatformSettings } from "@/lib/platform";
import { getBusinessT as getT, getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Plans" };

export default async function BillingPage() {
  const [membership, platform, t] = await Promise.all([
    requireManager("/dashboard/billing"),
    getPlatformSettings(),
    getT(),
  ]);

  const pricing = localizedPricing(platform, await getLocale());
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("plans.title")} description={t("plans.sub")} />
      <PlansPanel
        restaurant={membership.restaurant}
        menuPrice={pricing.menu}
        currency={pricing.currency}
        trialDays={platform.posTrialDays}
        menuBundlePrice={pricing.menu}
        posMonthly={pricing.monthly}
        posYearly={pricing.yearly}
        posEnabled={platform.posEnabled}
        whatsappUrl={platform.supportWhatsappUrl}
        whatsappDisplay={platform.supportWhatsappDisplay}
      />
    </div>
  );
}
