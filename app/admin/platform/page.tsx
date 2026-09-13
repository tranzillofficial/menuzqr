import type { Metadata } from "next";
import { createServerSupabase } from "@/lib/supabase/server";
import { PlatformSettingsForm } from "@/components/admin/PlatformSettingsForm";
import { Card } from "@/components/ui/Card";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Admin — Platform" };

export default async function AdminPlatformPage() {
  const [supabase, t] = await Promise.all([createServerSupabase(), getT()]);

  const { data, error } = await supabase
    .from("platform_settings")
    .select("support_whatsapp, support_email, brand_name, price_usd, activation_note")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return (
      <Card className="border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-semibold text-amber-900">{t("admin.platformTitle")}</h1>
        <p className="mt-2 text-sm text-amber-900">
          The <code className="font-mono">platform_settings</code> table is missing. Run{" "}
          <code className="font-mono">supabase/003-upgrades.sql</code> in the SQL editor, then
          reload this page.
        </p>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">{t("admin.platformTitle")}</h1>
        <p className="mt-1 text-sm text-ink-500">{t("admin.platformSub")}</p>
      </div>

      <PlatformSettingsForm
        settings={{
          support_whatsapp: data.support_whatsapp ?? "",
          support_email: data.support_email ?? null,
          brand_name: data.brand_name ?? "MenuzQR",
          price_usd: Number(data.price_usd ?? 20),
          activation_note: data.activation_note ?? null,
        }}
      />
    </div>
  );
}
