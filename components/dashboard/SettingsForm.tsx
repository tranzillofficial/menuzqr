"use client";

import { moduleEnabled } from "@/lib/business-modules";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateFeatureSettingsAction } from "@/lib/actions/restaurant";
import { Card, CardHeader } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useToast } from "@/components/ui/Toast";
import { useT, useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n";
import type { PaymentInstructions, Restaurant } from "@/lib/types";

type Settings = Partial<PaymentInstructions> & {
  sound_enabled: boolean;
  show_prices: boolean;
  show_ingredients: boolean;
};

type FeatureKey =
  | "ordering_enabled"
  | "waiter_calls_enabled"
  | "sound_enabled"
  | "show_prices"
  | "show_ingredients";

const ROWS: Array<{ key: FeatureKey; title: TranslationKey; description: TranslationKey }> = [
  { key: "ordering_enabled", title: "settings.ordering", description: "settings.orderingSub" },
  { key: "waiter_calls_enabled", title: "settings.waiter", description: "settings.waiterSub" },
  { key: "sound_enabled", title: "settings.sound", description: "settings.soundSub" },
  { key: "show_prices", title: "settings.showPrices", description: "settings.showPricesSub" },
  {
    key: "show_ingredients",
    title: "settings.showIngredients",
    description: "settings.showIngredientsSub",
  },
];

export function SettingsForm({
  restaurant,
  settings,
  hasTables,
}: {
  restaurant: Restaurant;
  settings: Settings;
  hasTables: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const {locale}=useI18n();const ar=locale==="ar";
  const tableOrdering=hasTables && moduleEnabled(restaurant,"tables");
  const [remote,setRemote]=useState(settings.remote_ordering_enabled??false);
  const [state, formAction] = useActionState(updateFeatureSettingsAction, null);

  const [values, setValues] = useState<Record<FeatureKey, boolean>>({
    ordering_enabled: restaurant.ordering_enabled,
    waiter_calls_enabled: restaurant.waiter_calls_enabled,
    sound_enabled: settings.sound_enabled,
    show_prices: settings.show_prices,
    show_ingredients: settings.show_ingredients,
  });

  useEffect(() => {
    if (!state) return;
    toast(state.message ?? "Saved.", state.ok ? "success" : "error");
    if (state.ok) router.refresh();
  }, [state, toast, router]);

  return (
    <form action={formAction}>
      <Card>
        <CardHeader
          title={t("settings.features")}
          description={t("settings.featuresSub")}
        />
        <ul className="divide-y divide-ink-100">
          {ROWS.filter(row => row.key === "waiter_calls_enabled" ? moduleEnabled(restaurant,"service_calls") : row.key === "ordering_enabled" ? moduleEnabled(restaurant,"orders") && tableOrdering : true).map((row) => (
            <li key={row.key} className="flex items-start gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900">{t(row.title)}</p>
                <p className="mt-0.5 text-sm text-ink-500">{t(row.description)}</p>
              </div>
              <Switch
                checked={values[row.key]}
                label={t(row.title)}
                onChange={(v) => setValues((s) => ({ ...s, [row.key]: v }))}
              />
              <input type="hidden" name={row.key} value={values[row.key] ? "on" : ""} />
            </li>
          ))}
        </ul>
        {!tableOrdering && <input type="hidden" name="ordering_enabled" value={remote?"on":""}/>}
        {moduleEnabled(restaurant,"orders") && <section className="space-y-3 border-t border-ink-100 px-5 py-4"><h3 className="font-semibold">{ar?'طلبات رابط المنتجات والتحويل الخارجي':'Online orders and external transfers'}</h3><label className="flex items-center justify-between gap-4 text-sm">{ar?'السماح بطلبات من الرابط العام بدون طاولة':'Allow orders from the public link without a table'}<Switch checked={remote} label={ar?'طلبات الرابط':'Online orders'} onChange={setRemote}/></label><input type="hidden" name="remote_ordering_enabled" value={remote?'on':''}/><p className="text-xs text-ink-500">{tableOrdering ? (ar?'فعّل استقبال الطلبات أعلاه ثم أضف محفظة كاش أو InstaPay ورقم واتساب. التحويل وإرسال صورة الإثبات بينك وبين العميل؛ الدفع لا يتأكد تلقائيًا.':'Enable ordering above and add a cash wallet or InstaPay and WhatsApp. Transfers and proof are handled privately; payment is never verified automatically.') : (ar?'أضف محفظة كاش أو InstaPay ورقم واتساب ثم فعّل استقبال الطلبات من الرابط. التحويل وإرسال صورة الإثبات بينك وبين العميل؛ الدفع لا يتأكد تلقائيًا.':'Add a cash wallet or InstaPay and WhatsApp, then enable online orders. Transfers and proof are handled privately; payment is never verified automatically.')}</p><label className="block text-sm">{ar?'رقم محفظة كاش':'Cash wallet number'}<input name="cash_wallet" dir="ltr" maxLength={30} defaultValue={settings.cash_wallet??''} className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm">{ar?'عنوان أو رقم InstaPay':'InstaPay address or number'}<input name="instapay_address" dir="ltr" maxLength={120} defaultValue={settings.instapay_address??''} className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm">{ar?'رقم واتساب لاستقبال إثبات التحويل (بكود الدولة، مثل 201…)':'WhatsApp for transfer proof (country code, e.g. 201…)'}<input name="payment_whatsapp" dir="ltr" maxLength={20} defaultValue={settings.payment_whatsapp??''} className="mt-1 w-full rounded-xl border p-3"/></label></section>}
        <div className="flex justify-end border-t border-ink-100 px-5 py-4">
          <SubmitButton>{t("settings.saveSettings")}</SubmitButton>
        </div>
      </Card>
    </form>
  );
}
