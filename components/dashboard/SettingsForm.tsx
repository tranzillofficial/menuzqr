"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateFeatureSettingsAction } from "@/lib/actions/restaurant";
import { Card, CardHeader } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useToast } from "@/components/ui/Toast";
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

const ROWS: Array<{ key: FeatureKey; title: string; description: string }> = [
  {
    key: "ordering_enabled",
    title: "Table ordering",
    description: "Guests who scan a table QR code can build a cart and send an order.",
  },
  {
    key: "waiter_calls_enabled",
    title: "Call waiter button",
    description: "Shows a “Call waiter” button on the menu when opened from a table code.",
  },
  {
    key: "sound_enabled",
    title: "Notification sound",
    description: "Play a chime on this dashboard for new orders and waiter calls.",
  },
  {
    key: "show_prices",
    title: "Show prices",
    description: "Turn off to display the menu without prices.",
  },
  {
    key: "show_ingredients",
    title: "Show ingredients",
    description: "Display the ingredient list under each product.",
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
          title="Menu features"
          description="Turn features on or off for your public menu and dashboard."
        />
        <ul className="divide-y divide-ink-100">
          {ROWS.map((row) => (
            <li key={row.key} className="flex items-start gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900">{row.title}</p>
                <p className="mt-0.5 text-sm text-ink-500">{row.description}</p>
              </div>
              <Switch
                checked={values[row.key]}
                label={row.title}
                onChange={(v) => setValues((s) => ({ ...s, [row.key]: v }))}
              />
              <input type="hidden" name={row.key} value={values[row.key] ? "on" : ""} />
            </li>
          ))}
        </ul>
        <div className="flex justify-end border-t border-ink-100 px-5 py-4">
          <SubmitButton>Save settings</SubmitButton>
        </div>
      </Card>
    </form>
  );
}
