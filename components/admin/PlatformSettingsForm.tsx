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
    support_whatsapp: string;
    support_email: string | null;
    brand_name: string;
    price_usd: number;
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
