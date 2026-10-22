"use client";

import { I18nProvider } from "@/components/i18n/I18nProvider";
import { MenuProvider } from "@/components/menu/MenuContext";
import { ProductSheet } from "@/components/menu/ProductSheet";
import { ElegantMenu } from "@/components/menu/themes/ElegantMenu";
import { ModernMenu } from "@/components/menu/themes/ModernMenu";
import { MinimalMenu } from "@/components/menu/themes/MinimalMenu";
import { NoirMenu } from "@/components/menu/themes/NoirMenu";
import { MarketMenu } from "@/components/menu/themes/MarketMenu";
import type { MenuThemeId } from "@/lib/constants";
import type { Locale } from "@/lib/i18n";
import type { MenuData } from "@/lib/types";

const themes = { elegant: ElegantMenu, modern: ModernMenu, minimal: MinimalMenu, noir: NoirMenu, market: MarketMenu };

// A shared sample keeps comparisons fair. No merchant data or order endpoints.
export function MenuThemePreview({ theme, locale }: { theme: MenuThemeId; locale: Locale }) {
  const ar = locale === "ar";
  const samples = [
    ["كابتشينو", "Cappuccino", 65, "/demo/d460c2dc-d0de-4bef-b9f4-e2082e363aa3.webp"],
    ["إسبريسو", "Espresso", 45, "/demo/c6bccb7d-8190-4b7b-86a0-ccadfc9f288b.webp"],
    ["تشيز كيك", "Cheesecake", 80, "/demo/cheesecake.webp"],
    ["كيك شوكولاتة", "Chocolate cake", 75, "/library/chocolate-cake.svg"],
  ] as const;
  const timestamp = "2026-01-01T00:00:00Z";
  const common = { restaurant_id: "theme-preview", created_at: timestamp, updated_at: timestamp, is_active: true };
  const data: MenuData = {
    restaurant: {
      id: "theme-preview", slug: "theme-preview", name: ar ? "كافيه بلوم" : "Bloom Café",
      description: ar ? "قهوة مختصة وحلويات تُحضّر بحب" : "Specialty coffee & freshly made desserts",
      logo_url: null, cover_url: "/demo/cover.webp", phone: null, address: null,
      currency: "EGP", language: locale, menu_theme: theme, business_kind: "restaurant",
      enabled_modules: ["products", "design", "qr", "features_v3"],
      ordering_enabled: false, waiter_calls_enabled: false,
      tax_mode: "none", vat_registered: false, prices_include_vat: true, business_timezone: "Africa/Cairo",
    },
    categories: [0, 1].map((index) => ({
      ...common, id: `preview-category-${index}`, name: index === 0 ? (ar ? "القهوة" : "Coffee") : (ar ? "الحلويات" : "Desserts"),
      description: null, image_url: null, sort_order: index,
      products: samples.slice(index * 2, index * 2 + 2).map(([nameAr, nameEn, price, image], order) => ({
        ...common, id: `preview-product-${index}-${order}`, category_id: `preview-category-${index}`,
        name: ar ? nameAr : nameEn, description: ar ? "اختيارك المفضل، محضّر طازجًا" : "Freshly prepared, just for you",
        ingredients: null, image_url: image, image_source: "library", sort_order: order, vat_code: "standard",
        product_variants: [{ id: `preview-option-${index}-${order}`, restaurant_id: common.restaurant_id, product_id: `preview-product-${index}-${order}`, name: ar ? "عادي" : "Regular", price, image_url: null, sort_order: 0, is_active: true, created_at: timestamp }],
      })),
    })),
  };
  const Theme = themes[theme];
  return <I18nProvider locale={locale}><div dir={ar ? "rtl" : "ltr"} lang={locale}>
    <MenuProvider data={data} table={null} showPrices showIngredients><Theme /><ProductSheet /></MenuProvider>
  </div></I18nProvider>;
}
