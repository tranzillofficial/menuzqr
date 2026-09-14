import "server-only";

import { cache } from "react";
import { createAdminSupabase } from "./supabase/admin";

export type PlatformSettings = {
  supportWhatsapp: string;
  supportWhatsappUrl: string;
  supportWhatsappDisplay: string;
  supportEmail: string | null;
  /** One-time fee for the QR menu + designs. */
  priceUsd: number;
  /** What that same one-time fee costs alongside a POS subscription. */
  menuBundleUsd: number;
  posMonthlyUsd: number;
  posYearlyUsd: number;
  /** POS is built but not shipped yet; this flips when it is. */
  posEnabled: boolean;
  brandName: string;
  activationNote: string | null;
};

const FALLBACK: PlatformSettings = {
  supportWhatsapp: "201094963553",
  supportWhatsappUrl: "https://wa.me/201094963553",
  supportWhatsappDisplay: "+20 109 496 3553",
  supportEmail: null,
  priceUsd: 20,
  menuBundleUsd: 8,
  posMonthlyUsd: 2,
  posYearlyUsd: 20,
  posEnabled: false,
  brandName: "MenuzQR",
  activationNote: null,
};

/**
 * Shows the number the way the admin typed it. Guessing where the country code
 * ends is unreliable across countries, so we never reformat — we only fall
 * back to "+<digits>" when the stored value has no formatting of its own.
 */
function displayNumber(raw: string, digits: string) {
  const trimmed = raw.trim();
  if (trimmed && /[^\d]/.test(trimmed)) return trimmed;
  return `+${digits}`;
}

/**
 * Platform-wide settings, editable from the admin dashboard.
 *
 * Cached per request. Falls back to sane defaults so the site still renders
 * before 003-upgrades.sql has been run, or if the row is somehow missing.
 */
export const getPlatformSettings = cache(async (): Promise<PlatformSettings> => {
  try {
    const supabase = createAdminSupabase();
    const { data } = await supabase
      .from("platform_settings")
      .select(
        "support_whatsapp, support_email, price_usd, brand_name, activation_note, menu_bundle_usd, pos_monthly_usd, pos_yearly_usd, pos_enabled"
      )
      .eq("id", 1)
      .maybeSingle();

    if (!data) return FALLBACK;

    const raw = String(data.support_whatsapp ?? "");
    const digits = raw.replace(/\D/g, "") || FALLBACK.supportWhatsapp;

    return {
      supportWhatsapp: digits,
      supportWhatsappUrl: `https://wa.me/${digits}`,
      supportWhatsappDisplay: displayNumber(raw, digits),
      supportEmail: data.support_email ?? null,
      priceUsd: Number(data.price_usd ?? FALLBACK.priceUsd),
      menuBundleUsd: Number(data.menu_bundle_usd ?? FALLBACK.menuBundleUsd),
      posMonthlyUsd: Number(data.pos_monthly_usd ?? FALLBACK.posMonthlyUsd),
      posYearlyUsd: Number(data.pos_yearly_usd ?? FALLBACK.posYearlyUsd),
      posEnabled: Boolean(data.pos_enabled ?? FALLBACK.posEnabled),
      brandName: data.brand_name || FALLBACK.brandName,
      activationNote: data.activation_note ?? null,
    };
  } catch {
    return FALLBACK;
  }
});
