"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { MENU_THEME_IDS, CURRENCIES, LANGUAGES } from "@/lib/constants";
import { randomSlug, slugify, validateSlug } from "@/lib/slug";
import type { ActionState } from "@/lib/types";
import {
  bool,
  deleteAssetIfOwned,
  done,
  fail,
  getOwnedRestaurant,
  optionalStr,
  sanitiseImageUrl,
  str,
} from "./helpers";

const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as string[];
const LANG_CODES = LANGUAGES.map((l) => l.code) as string[];

async function slugIsTaken(slug: string, exceptId?: string) {
  const admin = createAdminSupabase();
  let query = admin.from("restaurants").select("id").eq("slug", slug).limit(1);
  if (exceptId) query = query.neq("id", exceptId);
  const { data } = await query;
  return (data?.length ?? 0) > 0;
}

export async function createRestaurantAction(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("You need to sign in first.");

  const { data: existing } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1);
  if (existing && existing.length > 0) {
    return fail("You already have a restaurant. Edit it instead.");
  }

  const name = str(form, "name");
  if (name.length < 2) return fail("Enter a restaurant name.", { name: "Required." });

  const rawSlug = str(form, "slug") || slugify(name) || randomSlug(name);
  const { value: slug, error: slugError } = validateSlug(rawSlug);
  if (slugError) return fail(slugError, { slug: slugError });
  if (await slugIsTaken(slug)) {
    return fail("That link is already taken.", { slug: "Already taken — try another." });
  }

  const currency = str(form, "currency");
  const language = str(form, "language");

  const { error } = await supabase.from("restaurants").insert({
    owner_id: user.id,
    name,
    slug,
    description: optionalStr(form, "description"),
    phone: optionalStr(form, "phone"),
    address: optionalStr(form, "address"),
    restaurant_type: optionalStr(form, "restaurant_type"),
    currency: CURRENCY_CODES.includes(currency) ? currency : "USD",
    language: LANG_CODES.includes(language) ? language : "en",
    logo_url: sanitiseImageUrl(optionalStr(form, "logo_url")),
    cover_url: sanitiseImageUrl(optionalStr(form, "cover_url")),
  });

  if (error) return fail(error.message);

  revalidatePath("/dashboard", "layout");
  return done("Restaurant created.");
}

export async function updateRestaurantAction(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const owned = await getOwnedRestaurant();
  if (!owned.ok) return owned.error;
  const { restaurant } = owned;

  const name = str(form, "name");
  if (name.length < 2) return fail("Enter a restaurant name.", { name: "Required." });

  const { value: slug, error: slugError } = validateSlug(str(form, "slug") || restaurant.slug);
  if (slugError) return fail(slugError, { slug: slugError });
  if (slug !== restaurant.slug && (await slugIsTaken(slug, restaurant.id))) {
    return fail("That link is already taken.", { slug: "Already taken — try another." });
  }

  const currency = str(form, "currency");
  const language = str(form, "language");
  const logoUrl = sanitiseImageUrl(optionalStr(form, "logo_url"));
  const coverUrl = sanitiseImageUrl(optionalStr(form, "cover_url"));

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("restaurants")
    .update({
      name,
      slug,
      description: optionalStr(form, "description"),
      phone: optionalStr(form, "phone"),
      address: optionalStr(form, "address"),
      restaurant_type: optionalStr(form, "restaurant_type"),
      currency: CURRENCY_CODES.includes(currency) ? currency : restaurant.currency,
      language: LANG_CODES.includes(language) ? language : restaurant.language,
      logo_url: logoUrl,
      cover_url: coverUrl,
    })
    .eq("id", restaurant.id);

  if (error) return fail(error.message);

  if (restaurant.logo_url && restaurant.logo_url !== logoUrl) {
    await deleteAssetIfOwned(restaurant.logo_url, restaurant.id);
  }
  if (restaurant.cover_url && restaurant.cover_url !== coverUrl) {
    await deleteAssetIfOwned(restaurant.cover_url, restaurant.id);
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath(`/${slug}/menu`);
  if (slug !== restaurant.slug) revalidatePath(`/${restaurant.slug}/menu`);
  return done("Saved.");
}

export async function updateMenuThemeAction(theme: string): Promise<ActionState> {
  const owned = await getOwnedRestaurant();
  if (!owned.ok) return owned.error;
  if (!MENU_THEME_IDS.includes(theme as (typeof MENU_THEME_IDS)[number])) {
    return fail("Unknown menu design.");
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("restaurants")
    .update({ menu_theme: theme })
    .eq("id", owned.restaurant.id);

  if (error) return fail(error.message);

  revalidatePath("/dashboard/design");
  revalidatePath(`/${owned.restaurant.slug}/menu`);
  return done("Menu design updated.");
}

export async function updateFeatureSettingsAction(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const owned = await getOwnedRestaurant();
  if (!owned.ok) return owned.error;

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("restaurants")
    .update({
      ordering_enabled: bool(form, "ordering_enabled"),
      waiter_calls_enabled: bool(form, "waiter_calls_enabled"),
    })
    .eq("id", owned.restaurant.id);

  if (error) return fail(error.message);

  const { error: settingsError } = await supabase
    .from("restaurant_settings")
    .upsert(
      {
        restaurant_id: owned.restaurant.id,
        sound_enabled: bool(form, "sound_enabled"),
        show_prices: bool(form, "show_prices"),
        show_ingredients: bool(form, "show_ingredients"),
      },
      { onConflict: "restaurant_id" }
    );

  if (settingsError) return fail(settingsError.message);

  revalidatePath("/dashboard/settings");
  revalidatePath(`/${owned.restaurant.slug}/menu`);
  return done("Settings saved.");
}
