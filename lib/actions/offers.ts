"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  getMenuRestaurant,
  done,
  fail,
  str,
  bool,
  sanitiseImageUrl,
  optionalStr,
} from "./helpers";
import { createServerSupabase } from "@/lib/supabase/server";
import { businessDayRange, businessLocalInstant } from "@/lib/business-time";
import { featureEnabled } from "@/lib/business-features";
import type { ActionState } from "@/lib/types";
function refresh(slug: string) {
  revalidatePath("/dashboard/offers");
  revalidatePath(`/${slug}/menu`);
  revalidatePath(`/${slug}/offers`);
  revalidateTag(`menu-products:${slug}`, { expire: 0 });
}
export async function saveOffer(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const owned = await getMenuRestaurant("offers");
  if (!owned.ok) return owned.error;
  const { restaurant } = owned;
  const id = str(form, "id"),
    title = str(form, "title"),
    description = str(form, "description"),
    type = str(form, "offer_type") || "promotion",
    product_ids = [
      ...new Set(
        form
          .getAll("product_ids")
          .filter((v): v is string => typeof v === "string"),
      ),
    ];
  if (
    title.length < 2 ||
    title.length > 100 ||
    description.length > 1200 ||
    product_ids.length > 100 ||
    !["promotion", "bundle", "discount"].includes(type)
  )
    return fail("راجع عنوان العرض ووصفه والمنتجات المختارة.");
  if (
    (type === "bundle" && !featureEnabled(restaurant, "offer_bundle")) ||
    (type === "discount" && !featureEnabled(restaurant, "offer_discount"))
  )
    return fail("هذا النوع من العروض غير متاح لهذا الحساب.");
  const db = await createServerSupabase();
  const current = id
    ? await db
        .from("business_offers")
        .select("*")
        .eq("id", id)
        .eq("restaurant_id", restaurant.id)
        .maybeSingle()
    : null;
  if (id && (current?.error || !current?.data)) return fail("العرض غير موجود.");
  if (product_ids.length) {
    const { data, error } = await db
      .from("products")
      .select("id")
      .eq("restaurant_id", restaurant.id)
      .in("id", product_ids);
    if (error || data?.length !== product_ids.length)
      return fail("اختار منتجات من نفس النشاط.");
  }
  let starts_at: string | null = current?.data?.starts_at ?? null,
    ends_at: string | null = current?.data?.ends_at ?? null;
  if (featureEnabled(restaurant, "offer_schedule")) {
    starts_at = null;
    ends_at = null;
    try {
      const allDay = bool(form, "all_day");
      if (str(form, "starts_on"))
        starts_at = allDay
          ? businessDayRange(
              str(form, "starts_on"),
              restaurant.business_timezone,
            ).start
          : businessLocalInstant(
              str(form, "starts_on"),
              str(form, "starts_time"),
              restaurant.business_timezone,
            );
      if (str(form, "ends_on"))
        ends_at = allDay
          ? businessDayRange(str(form, "ends_on"), restaurant.business_timezone)
              .end
          : businessLocalInstant(
              str(form, "ends_on"),
              str(form, "ends_time"),
              restaurant.business_timezone,
            );
      if (!allDay && (!starts_at || !ends_at))
        return fail("حدد تاريخ ووقت البداية والنهاية.");
    } catch {
      return fail("راجع التاريخ والوقت حسب توقيت النشاط.");
    }
  }
  if (starts_at && ends_at && starts_at >= ends_at)
    return fail("تاريخ النهاية يجب أن يكون بعد البداية.");
  let items: unknown = [];
  try {
    items = JSON.parse(str(form, "bundle_items") || "[]");
  } catch {
    return fail("راجع منتجات العرض.");
  }
  if (
    !Array.isArray(items) ||
    items.length > 30 ||
    items.some(
      (i) =>
        !i ||
        typeof i.variant_id !== "string" ||
        !Number.isInteger(i.quantity) ||
        i.quantity < 1 ||
        i.quantity > 99,
    )
  )
    return fail("راجع الكميات ووحدات البيع.");
  const sale = str(form, "sale_price"),
    value = str(form, "discount_value");
  if (
    type === "bundle" &&
    (!sale || !Number.isFinite(Number(sale)) || Number(sale) < 0)
  )
    return fail("حدد سعر بيع صحيح للباكدج.");
  if (
    type === "discount" &&
    (!value ||
      !Number.isFinite(Number(value)) ||
      Number(value) < 0 ||
      !["fixed", "percent"].includes(str(form, "discount_kind")))
  )
    return fail("راجع قيمة الخصم.");
  const payload = {
    restaurant_id: restaurant.id,
    title,
    description,
    product_ids,
    offer_type: type,
    bundle_items: items,
    sale_price: type === "bundle" ? Number(sale) : null,
    discount_kind: type === "discount" ? str(form, "discount_kind") : null,
    discount_value: type === "discount" ? Number(value) : null,
    starts_at,
    ends_at,
    is_active: bool(form, "is_active"),
    all_day: bool(form, "all_day"),
    ...(featureEnabled(restaurant, "offer_images")
      ? { image_url: sanitiseImageUrl(optionalStr(form, "image_url")) }
      : {}),
  };
  const request = id
    ? db
        .from("business_offers")
        .update(payload)
        .eq("id", id)
        .eq("restaurant_id", restaurant.id)
    : db.from("business_offers").insert(payload);
  const { data, error } = await request.select("id").maybeSingle();
  if (error || !data)
    return fail("تعذر حفظ العرض. راجع المنتجات والكميات وسعر البيع.");
  refresh(restaurant.slug);
  return done("تم حفظ العرض.");
}
export async function deleteOffer(id: string) {
  const owned = await getMenuRestaurant("offers");
  if (!owned.ok) return owned.error;
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("business_offers")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", owned.restaurant.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return fail("تعذر حذف العرض.");
  refresh(owned.restaurant.slug);
  return done("تم حذف العرض.");
}
export async function unpublishOffer(id: string) {
  const owned = await getMenuRestaurant("offers");
  if (!owned.ok) return owned.error;
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("business_offers")
    .update({ is_active: false })
    .eq("id", id)
    .eq("restaurant_id", owned.restaurant.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return fail("تعذر إيقاف العرض.");
  refresh(owned.restaurant.slug);
  return done("تم إيقاف العرض.");
}
