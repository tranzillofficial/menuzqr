"use server";

import {normalizeWhatsapp} from "@/lib/phone";
import {featureEnabled} from "@/lib/business-features";
import { moduleEnabled } from "@/lib/business-modules";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { MENU_THEME_IDS, CURRENCIES, LANGUAGES } from "@/lib/constants";
import { randomSlug, slugify, validateSlug } from "@/lib/slug";
import type { ActionState } from "@/lib/types";
import {
  assertAdmin,
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
    return fail("That link is already taken.", { slug: "Already taken. try another." });
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
    return fail("That link is already taken.", { slug: "Already taken. try another." });
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
  const owned = await getOwnedRestaurant("design");
  if (!owned.ok) return owned.error;
  if (!moduleEnabled(owned.restaurant,"design")) return fail("Menu design is disabled for this account.");
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
  const owned = await getOwnedRestaurant("settings");
  if (!owned.ok) return owned.error;

  const wallet = str(form,"cash_wallet").replace(/[\s()-]/g,"");
  const instapay = str(form,"instapay_address");
  const existingSettings = !form.has("payment_whatsapp") ? await (await createServerSupabase()).from("restaurant_settings").select("payment_whatsapp").eq("restaurant_id",owned.restaurant.id).maybeSingle() : null;
  if(existingSettings?.error)return fail(existingSettings.error.message);
  const whatsapp = form.has("payment_whatsapp") ? normalizeWhatsapp(str(form,"payment_whatsapp")) : existingSettings?.data?.payment_whatsapp ?? "";
  const remote = featureEnabled(owned.restaurant,"online_ordering") && bool(form,"remote_ordering_enabled");
  if(wallet && !/^\+?\d{8,15}$/.test(wallet) || whatsapp && !/^\d{8,15}$/.test(whatsapp) || wallet.length>30 || instapay.length>120) return fail("راجع أرقام التحويل والواتساب، واكتب كود الدولة لرقم الواتساب.");
  if(remote && owned.restaurant.business_kind!=="supermarket" && (!(wallet||instapay)||!whatsapp)) return fail("أضف رقم محفظة كاش أو بيانات InstaPay ورقم واتساب قبل تفعيل طلبات الرابط.");
  const supabase = await createServerSupabase();
  const {error}=await supabase.rpc("save_storefront_settings",{p_restaurant:owned.restaurant.id,p_ordering:featureEnabled(owned.restaurant,"online_ordering")&&bool(form,"ordering_enabled"),p_waiter:moduleEnabled(owned.restaurant,"service_calls")&&bool(form,"waiter_calls_enabled"),p_sound:bool(form,"sound_enabled"),p_prices:bool(form,"show_prices"),p_ingredients:bool(form,"show_ingredients"),p_remote:owned.restaurant.business_kind==="supermarket"?false:remote,p_wallet:wallet,p_instapay:instapay,p_whatsapp:whatsapp});
  if(error)return fail(error.message);

  revalidatePath("/dashboard/settings");
  revalidatePath(`/${owned.restaurant.slug}/menu`);
  return done("Settings saved.");
}

export async function saveWhatsappQrAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const adminId = str(form, "restaurant_id");
  let restaurantId: string;
  if (adminId) {
    const admin = await assertAdmin();
    if (!admin.ok) return admin.error;
    restaurantId = adminId;
  } else {
    const owned = await getOwnedRestaurant("settings");
    if (!owned.ok) return owned.error;
    restaurantId = owned.restaurant.id;
  }
  const phone = normalizeWhatsapp(str(form, "whatsapp_number"));
  if (phone && !/^[1-9]\d{7,14}$/.test(phone)) return fail("اكتب رقم واتساب بكود الدولة، مثل 201012345678. Enter a number with country code.");
  const db = await createServerSupabase();
  const { error } = await db.from("restaurant_settings").upsert({ restaurant_id: restaurantId, payment_whatsapp: phone }, { onConflict: "restaurant_id" });
  if (error) return fail("تعذر حفظ الرقم. لو طلبات التحويل مفعلة، يلزم الاحتفاظ برقم واتساب. Could not save WhatsApp number.");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/qr-codes");
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return done("تم حفظ رقم واتساب. WhatsApp number saved.");
}
