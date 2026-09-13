import type { Metadata } from "next";
import { requireRestaurant } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/Shell";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { ActivationPanel } from "@/components/dashboard/ActivationPanel";
import { Card, CardHeader } from "@/components/ui/Card";
import { PRICE_USD, SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/lib/constants";
import { Icon } from "@/components/ui/Icons";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const restaurant = await requireRestaurant();
  const supabase = await createServerSupabase();

  const { data: settings } = await supabase
    .from("restaurant_settings")
    .select("sound_enabled, show_prices, show_ingredients")
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Features, activation and support." />

      <ActivationPanel restaurant={restaurant} />

      <SettingsForm
        restaurant={restaurant}
        settings={{
          sound_enabled: settings?.sound_enabled ?? true,
          show_prices: settings?.show_prices ?? true,
          show_ingredients: settings?.show_ingredients ?? true,
        }}
      />

      <Card>
        <CardHeader title="Plan & billing" />
        <dl className="divide-y divide-ink-100 text-sm">
          {[
            ["Plan", `MenuzQR — $${PRICE_USD} one-time`],
            [
              "Payment status",
              restaurant.payment_status === "paid" ? "Paid" : "Awaiting payment",
            ],
            ["Activated", formatDate(restaurant.activated_at)],
            ["Menu link", `/${restaurant.slug}/menu`],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 px-5 py-3">
              <dt className="text-ink-500">{label}</dt>
              <dd className="text-right font-medium text-ink-900">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-ink-100 px-5 py-4">
          <p className="text-sm text-ink-600">
            Payments are handled manually over WhatsApp. Send your payment, message us, and we
            activate your menu.
          </p>
          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white hover:brightness-95"
          >
            <Icon.whatsapp className="size-4" />
            {SUPPORT_WHATSAPP_DISPLAY}
          </a>
        </div>
      </Card>
    </div>
  );
}
