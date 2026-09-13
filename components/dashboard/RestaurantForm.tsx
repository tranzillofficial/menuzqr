"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createRestaurantAction, updateRestaurantAction } from "@/lib/actions/restaurant";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Card, CardHeader } from "@/components/ui/Card";
import { ImagePicker } from "@/components/ui/ImagePicker";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/i18n/I18nProvider";
import { CURRENCIES, LANGUAGES, RESTAURANT_TYPES } from "@/lib/constants";
import { slugify } from "@/lib/slug";
import { siteOrigin } from "@/lib/utils";
import type { Restaurant } from "@/lib/types";

export function RestaurantForm({ restaurant }: { restaurant: Restaurant | null }) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
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
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

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
          title={t("restaurant.details")}
          description={t("restaurant.detailsSub")}
        />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label={t("restaurant.name")} htmlFor="name" required error={state?.fieldErrors?.name}>
            <Input
              id="name"
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
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

          <Field label={t("restaurant.type")} htmlFor="restaurant_type" className="sm:col-span-2">
            <Select
              id="restaurant_type"
              name="restaurant_type"
              defaultValue={restaurant?.restaurant_type ?? ""}
            >
              <option value="">{t("restaurant.typePlaceholder")}</option>
              {RESTAURANT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t("restaurant.description")} htmlFor="description" className="sm:col-span-2">
            <Textarea
              id="description"
              name="description"
              defaultValue={restaurant?.description ?? ""}
              maxLength={280}
              placeholder="Specialty coffee and all-day brunch in the heart of downtown."
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
            <Select id="currency" name="currency" defaultValue={restaurant?.currency ?? "USD"}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t("restaurant.menuLanguage")} htmlFor="language">
            <Select id="language" name="language" defaultValue={restaurant?.language ?? "en"}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
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
      ) : (
        <p className="rounded-xl bg-ink-100 px-4 py-3 text-sm text-ink-600">
          {t("restaurant.saveFirst")}
        </p>
      )}

      <input type="hidden" name="logo_url" value={logoUrl ?? ""} />
      <input type="hidden" name="cover_url" value={coverUrl ?? ""} />

      <div className="flex justify-end">
        <SubmitButton size="lg">{isEdit ? t("common.saveChanges") : t("restaurant.create")}</SubmitButton>
      </div>
    </form>
  );
}
