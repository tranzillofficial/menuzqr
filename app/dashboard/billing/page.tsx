import {getUser} from '@/lib/auth';
import {normalizeDraft} from '@/lib/onboarding';
import {activityLabel} from '@/lib/activity-pricing';
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

  const user=await getUser();
  const requested=normalizeDraft(user?.user_metadata?.menuzqr_onboarding);
  const ar=await getLocale()==='ar';
  const pricing = localizedPricing(platform, await getLocale());
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("plans.title")} description={t("plans.sub")} />
      {requested.activity && membership.restaurant.owner_id===user?.id && <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm"><p className="font-semibold">{ar?'طلبك أثناء التسجيل':'Your signup request'}: {activityLabel(requested.activity,ar)} · {requested.plan==='qr'?'Basic':requested.plan}</p><p className="mt-2 text-xs leading-6 text-ink-600">{ar?'هذا اختيار مبدئي وليس اشتراكًا مفعّلًا. التفعيل والخصائص بعد مراجعة فريق الدعم للدفع.':'This is your requested plan, not an activated subscription. Support confirms payment and enables the agreed features.'}</p></div>}
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
