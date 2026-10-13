"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMenuRestaurant, str, done, fail } from "./helpers";
import { featureEnabled } from "@/lib/business-features";
import {
  validateQrPreference,
  QR_KINDS,
  type QrKind,
} from "@/lib/qr-preferences";
import type { ActionState } from "@/lib/types";
export async function saveQrSettings(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const owner = await getMenuRestaurant("qr");
  if (!owner.ok) return owner.error;
  const kind = str(form, "kind") as QrKind;
  if (
    !QR_KINDS.includes(kind) ||
    !featureEnabled(owner.restaurant, "qr_design")
  )
    return fail("تخصيص QR غير متاح لهذا الحساب.");
  const preference = {
    title: str(form, "title"),
    subtitle: str(form, "subtitle"),
    theme: str(form, "theme"),
    template_id: str(form, "template_id"),
  };
  if (!validateQrPreference(preference))
    return fail("راجع الاسم والنص والتصميم.");
  const db = await createServerSupabase();
  if (preference.template_id) {
    const { data } = await db
      .from("qr_templates")
      .select("scope")
      .eq("id", preference.template_id)
      .eq("is_active", true)
      .maybeSingle();
    if (
      !data ||
      (kind === "table" && data.scope === "general") ||
      (kind !== "table" && data.scope === "table")
    )
      return fail("التصميم غير متاح لهذا الكود.");
  }
  const { error } = await db.rpc("save_qr_preference", {
    p_restaurant: owner.restaurant.id,
    p_kind: kind,
    p_preference: preference,
  });
  if (error) return fail("تعذر حفظ التصميم.");
  revalidatePath("/dashboard/qr-codes");
  return done("تم حفظ إعدادات QR.");
}
