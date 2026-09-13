"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createRestaurantAction, updateRestaurantAction } from "@/lib/actions/restaurant";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Card, CardHeader } from "@/components/ui/Card";
import { ImagePicker } from "@/components/ui/ImagePicker";
import { useToast } from "@/components/ui/Toast";
import { CURRENCIES, LANGUAGES, RESTAURANT_TYPES } from "@/lib/constants";
import { slugify } from "@/lib/slug";
import type { Restaurant } from "@/lib/types";

export function RestaurantForm({ restaurant }: { restaurant: Restaurant | null }) {
  const router = useRouter();
  const toast = useToast();
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

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "").replace(/\/$/, "") ||
    "menuzqr.com";

  return (
    <form action={formAction} className="space-y-5">
      <Card>
        <CardHeader
          title="Restaurant details"
          description="This is what your guests see at the top of the menu."
        />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label="Restaurant name" htmlFor="name" required error={state?.fieldErrors?.name}>
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
            label="Menu link"
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

          <Field label="Restaurant type" htmlFor="restaurant_type" className="sm:col-span-2">
            <Select
              id="restaurant_type"
              name="restaurant_type"
              defaultValue={restaurant?.restaurant_type ?? ""}
            >
              <option value="">Choose a type (helps AI suggestions)</option>
              {RESTAURANT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Short description" htmlFor="description" className="sm:col-span-2">
            <Textarea
              id="description"
              name="description"
              defaultValue={restaurant?.description ?? ""}
              maxLength={280}
              placeholder="Specialty coffee and all-day brunch in the heart of downtown."
            />
          </Field>

          <Field label="Phone" htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={restaurant?.phone ?? ""}
              placeholder="+20 100 000 0000"
            />
          </Field>

          <Field label="Address" htmlFor="address">
            <Input
              id="address"
              name="address"
              defaultValue={restaurant?.address ?? ""}
              placeholder="12 Nile St, Cairo"
            />
          </Field>

          <Field label="Currency" htmlFor="currency">
            <Select id="currency" name="currency" defaultValue={restaurant?.currency ?? "USD"}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Menu language" htmlFor="language">
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
          <CardHeader title="Branding" description="A square logo and a wide cover photo." />
          <div className="grid gap-6 p-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-ink-800">Logo</p>
              <ImagePicker
                restaurantId={restaurant.id}
                kind="logo"
                value={logoUrl}
                onChange={(url) => setLogoUrl(url)}
                allowLibrary={false}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink-800">Cover photo</p>
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
          Save your restaurant first — then you can upload a logo and cover photo.
        </p>
      )}

      <input type="hidden" name="logo_url" value={logoUrl ?? ""} />
      <input type="hidden" name="cover_url" value={coverUrl ?? ""} />

      <div className="flex justify-end">
        <SubmitButton size="lg">{isEdit ? "Save changes" : "Create restaurant"}</SubmitButton>
      </div>
    </form>
  );
}
