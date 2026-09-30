import "server-only";

import { cache } from "react";
import { createAdminSupabase } from "./supabase/admin";

export type PlatformSettings = {
  priceEgp: number;
  originalPriceEgp: number;
  originalPriceUsd: number;
  posMonthlyEgp: number;
  posYearlyEgp: number;
  posTrialDays: number;
  offerEnabled: boolean;
  demoRestaurantSlug: string;
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
  priceEgp: 800,
  originalPriceEgp: 1000,
  originalPriceUsd: 20,
  posMonthlyEgp: 100,
  posYearlyEgp: 1000,
  posTrialDays: 30,
  offerEnabled: true,
  demoRestaurantSlug: "demo",
  supportWhatsapp: "201094963553",
  supportWhatsappUrl: "https://wa.me/201094963553",
  supportWhatsappDisplay: "+20 109 496 3553",
  supportEmail: null,
  priceUsd: 16,
  menuBundleUsd: 8,
  posMonthlyUsd: 2,
  posYearlyUsd: 20,
  posEnabled: true,
  brandName: "MenuzQR",
  activationNote: null,
};

/**
 * Shows the number the way the admin typed it. Guessing where the country code
 * ends is unreliable across countries, so we never reformat. we only fall
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
        "*"
      )
      .eq("id", 1)
      .maybeSingle();

    if (!data) return FALLBACK;

    const raw = String(data.support_whatsapp ?? "");
    const digits = raw.replace(/\D/g, "") || FALLBACK.supportWhatsapp;

    return {
      priceEgp: Number(data.price_egp ?? FALLBACK.priceEgp),
      originalPriceEgp: Number(data.original_price_egp ?? FALLBACK.originalPriceEgp),
      originalPriceUsd: Number(data.original_price_usd ?? FALLBACK.originalPriceUsd),
      posMonthlyEgp: Number(data.pos_monthly_egp ?? FALLBACK.posMonthlyEgp),
      posYearlyEgp: Number(data.pos_yearly_egp ?? FALLBACK.posYearlyEgp),
      posTrialDays: Number(data.pos_trial_days ?? FALLBACK.posTrialDays),
      offerEnabled: data.offer_enabled ?? true,
      demoRestaurantSlug: data.demo_restaurant_slug || "demo",
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
