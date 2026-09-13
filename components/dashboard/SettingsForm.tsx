"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateFeatureSettingsAction } from "@/lib/actions/restaurant";
import { Card, CardHeader } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n";
import type { Restaurant } from "@/lib/types";

type Settings = {
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
}: {
  restaurant: Restaurant;
  settings: Settings;
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
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
          {ROWS.map((row) => (
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
        <div className="flex justify-end border-t border-ink-100 px-5 py-4">
          <SubmitButton>{t("settings.saveSettings")}</SubmitButton>
        </div>
      </Card>
    </form>
  );
}
