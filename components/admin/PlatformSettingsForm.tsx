"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { savePlatformSettingsAction } from "@/lib/actions/admin";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/i18n/I18nProvider";

export function PlatformSettingsForm({
  settings,
}: {
  settings: {
    price_egp: number;
    original_price_egp: number;
    original_price_usd: number;
    pos_monthly_egp: number;
    pos_yearly_egp: number;
    pos_trial_days: number;
    offer_enabled: boolean;
    demo_restaurant_slug: string;
    support_whatsapp: string;
    support_email: string | null;
    brand_name: string;
    price_usd: number;
    menu_bundle_usd: number;
    pos_monthly_usd: number;
    pos_yearly_usd: number;
    pos_enabled: boolean;
    activation_note: string | null;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const [state, formAction] = useActionState(savePlatformSettingsAction, null);

  useEffect(() => {
    if (!state) return;
    toast(state.message ?? "Saved.", state.ok ? "success" : "error");
    if (state.ok) router.refresh();
  }, [state, toast, router]);

  return (
    <form action={formAction}>
      <Card>
        <CardHeader title={t("admin.platformTitle")} description={t("admin.platformSub")} />

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field
            label={t("admin.supportWhatsapp")}
            htmlFor="support_whatsapp"
            required
            hint={t("admin.supportWhatsappHint")}
            className="sm:col-span-2"
          >
            <Input
              id="support_whatsapp"
              name="support_whatsapp"
              required
              dir="ltr"
              defaultValue={settings.support_whatsapp}
              placeholder="201094963553"
            />
          </Field>

          <Field label={t("admin.supportEmail")} htmlFor="support_email">
            <Input
              id="support_email"
              name="support_email"
              type="email"
              dir="ltr"
              defaultValue={settings.support_email ?? ""}
            />
          </Field>

          <Field label={t("admin.brandName")} htmlFor="brand_name">
            <Input id="brand_name" name="brand_name" defaultValue={settings.brand_name} />
          </Field>

          {([['price_egp','سعر المنيو بالجنيه'],['original_price_egp','السعر قبل العرض بالجنيه'],['original_price_usd','السعر قبل العرض بالدولار'],['pos_monthly_egp','الكاشير شهري بالجنيه'],['pos_yearly_egp','الكاشير سنوي بالجنيه'],['pos_trial_days','أيام الكاشير المجانية']] as const).map(([name,label]) => <Field key={name} label={label} htmlFor={name}><Input id={name} name={name} type="number" min={0} step="1" defaultValue={settings[name]} /></Field>)}
          <label className="flex gap-2"><input type="checkbox" name="offer_enabled" defaultChecked={settings.offer_enabled} />تفعيل العرض لفترة محدودة</label>
          <Field label="رابط المنيو التجريبي" htmlFor="demo_restaurant_slug"><Input id="demo_restaurant_slug" name="demo_restaurant_slug" defaultValue={settings.demo_restaurant_slug} /></Field>
          <Field label={t("admin.priceUsd")} htmlFor="price_usd">
            <Input
              id="price_usd"
              name="price_usd"
              type="number"
              min={0}
              step="1"
              dir="ltr"
              defaultValue={String(settings.price_usd)}
            />
          </Field>

          <input type="hidden" name="menu_bundle_usd" value={settings.price_usd} />

          <Field label={t("admin.posMonthlyUsd")} htmlFor="pos_monthly_usd">
            <Input
              id="pos_monthly_usd"
              name="pos_monthly_usd"
              type="number"
              min={0}
              step="1"
              dir="ltr"
              defaultValue={String(settings.pos_monthly_usd)}
            />
          </Field>

          <Field label={t("admin.posYearlyUsd")} htmlFor="pos_yearly_usd">
            <Input
              id="pos_yearly_usd"
              name="pos_yearly_usd"
              type="number"
              min={0}
              step="1"
              dir="ltr"
              defaultValue={String(settings.pos_yearly_usd)}
            />
          </Field>

          <label className="flex items-start gap-3 rounded-xl border border-ink-200 p-3 sm:col-span-2">
            <input
              type="checkbox"
              name="pos_enabled"
              defaultChecked={settings.pos_enabled}
              className="mt-0.5 size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-200"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink-800">{t("admin.posEnabled")}</span>
              <span className="block text-xs text-ink-500">{t("admin.posEnabledHint")}</span>
            </span>
          </label>

          <Field
            label={t("admin.activationNote")}
            htmlFor="activation_note"
            hint={t("admin.activationNoteHint")}
            className="sm:col-span-2"
          >
            <Textarea
              id="activation_note"
              name="activation_note"
              maxLength={300}
              defaultValue={settings.activation_note ?? ""}
            />
          </Field>
        </div>

        <div className="flex justify-end border-t border-ink-100 px-5 py-4">
          <SubmitButton>{t("common.saveChanges")}</SubmitButton>
        </div>
      </Card>
    </form>
  );
}
