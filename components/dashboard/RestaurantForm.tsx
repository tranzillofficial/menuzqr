"use client";

import { moduleEnabled } from "@/lib/business-modules";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createRestaurantAction, updateRestaurantAction } from "@/lib/actions/restaurant";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Card, CardHeader } from "@/components/ui/Card";
import { ImagePicker } from "@/components/ui/ImagePicker";
import { useToast } from "@/components/ui/Toast";
import { useT, useI18n } from "@/components/i18n/I18nProvider";
import { CURRENCIES } from "@/lib/constants";
import { slugify } from "@/lib/slug";
import { siteOrigin } from "@/lib/utils";
import type { Restaurant } from "@/lib/types";

export function RestaurantForm({ restaurant }: { restaurant: Restaurant | null }) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const { locale } = useI18n();
  const retail = restaurant?.enabled_modules != null && !moduleEnabled(restaurant,"tables");
  const isEdit = Boolean(restaurant);

  const [state, formAction] = useActionState(
    isEdit ? updateRestaurantAction : createRestaurantAction,
    null
  );

  const [name, setName] = useState(restaurant?.name ?? "");
  const [slug, setSlug] = useState(restaurant?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(restaurant));
  const [logoUrl, setLogoUrl] = useState(restaurant?.logo_url ?? null);
  const [coverUrl, setCoverUrl] = useState(restaurant?.cover_url ?? null);


  useEffect(() => {
    if (!state) return;
    toast(state.message ?? (state.ok ? "Saved." : "Something went wrong."), state.ok ? "success" : "error");
    if (state.ok) router.refresh();
  }, [state, toast, router]);

  const origin = siteOrigin().replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <form action={formAction} className="space-y-5">
      <Card>
        <CardHeader
          title={retail ? (locale==="ar"?"بيانات الفرع":"Branch details") : t("restaurant.details")}
          description={retail ? undefined : t("restaurant.detailsSub")}
        />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label={retail ? (locale==="ar"?"اسم الفرع":"Branch name") : t("restaurant.name")} htmlFor="name" required error={state?.fieldErrors?.name}>
            <Input
              id="name"
              name="name"
              required
              value={name}
              onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }}
              placeholder="Cairo Café"
            />
          </Field>

          <Field
            label={t("restaurant.link")}
            htmlFor="slug"
            required
            error={state?.fieldErrors?.slug}
            hint={
              <span className="break-all">
                {origin}/<strong>{slug || "your-restaurant"}</strong>/menu
              </span>
            }
          >
            <Input
              id="slug"
              name="slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="cairo-cafe"
            />
          </Field>


          <details className="sm:col-span-2 rounded-xl border border-ink-200 p-4">
            <summary className="cursor-pointer text-sm font-medium">{locale === "ar" ? "بيانات إضافية اختيارية" : "Optional details"}</summary>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field label={t("restaurant.description")} htmlFor="description" className="sm:col-span-2">
            <Textarea
              id="description"
              name="description"
              defaultValue={restaurant?.description ?? ""}
              maxLength={280}
              placeholder={locale === "ar" ? "وصف مختصر لمطعمك أو كافيهك" : "A short introduction to your restaurant"}
            />
          </Field>

          <Field label={t("restaurant.phone")} htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={restaurant?.phone ?? ""}
              placeholder="+20 100 000 0000"
            />
          </Field>

          <Field label={t("restaurant.address")} htmlFor="address">
            <Input
              id="address"
              name="address"
              defaultValue={restaurant?.address ?? ""}
              placeholder="12 Nile St, Cairo"
            />
          </Field>

          <Field label={t("restaurant.currency")} htmlFor="currency">
            <Select id="currency" name="currency" defaultValue={restaurant?.currency ?? (locale === "ar" ? "EGP" : "USD")}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </Select>
          </Field>

            </div>
          </details>
          <input type="hidden" name="language" value={restaurant?.language ?? locale} />
        </div>
      </Card>

      {restaurant ? (
        <Card>
          <CardHeader title={t("restaurant.branding")} description={t("restaurant.brandingSub")} />
          <div className="grid gap-6 p-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-ink-800">{t("restaurant.logo")}</p>
              <ImagePicker
                restaurantId={restaurant.id}
                kind="logo"
                value={logoUrl}
                onChange={(url) => setLogoUrl(url)}
                allowLibrary={false}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink-800">{t("restaurant.cover")}</p>
              <ImagePicker
                restaurantId={restaurant.id}
                kind="cover"
                value={coverUrl}
                onChange={(url) => setCoverUrl(url)}
                aspect="wide"
                allowLibrary={false}
              />
            </div>
          </div>
        </Card>
      ) : null}

      <input type="hidden" name="logo_url" value={logoUrl ?? ""} />
      <input type="hidden" name="cover_url" value={coverUrl ?? ""} />

      <div className="flex justify-end">
        <SubmitButton size="lg">{isEdit ? t("common.saveChanges") : t("restaurant.create")}</SubmitButton>
      </div>
    </form>
  );
}
