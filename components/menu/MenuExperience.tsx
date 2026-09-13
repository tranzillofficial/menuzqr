"use client";

import { MenuProvider } from "./MenuContext";
import { ProductSheet } from "./ProductSheet";
import { CartBar } from "./CartSheet";
import { WaiterButton } from "./WaiterButton";
import { ElegantMenu } from "./themes/ElegantMenu";
import { ModernMenu } from "./themes/ModernMenu";
import { MinimalMenu } from "./themes/MinimalMenu";
import { NoirMenu } from "./themes/NoirMenu";
import { MarketMenu } from "./themes/MarketMenu";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { dirOf, isLocale, createTranslator, type Locale } from "@/lib/i18n";
import type { MenuData } from "@/lib/types";

const THEMES = {
  elegant: ElegantMenu,
  modern: ModernMenu,
  minimal: MinimalMenu,
  noir: NoirMenu,
  market: MarketMenu,
} as const;

export function MenuExperience({
  data,
  table,
  tableToken,
  showPrices,
  showIngredients,
  staffMode = false,
}: {
  data: MenuData;
  table: { id: string; label: string } | null;
  tableToken: string;
  showPrices: boolean;
  showIngredients: boolean;
  staffMode?: boolean;
}) {
  const Theme = THEMES[data.restaurant.menu_theme] ?? ElegantMenu;
  const lightFab = data.restaurant.menu_theme === "elegant" || data.restaurant.menu_theme === "market";

  // The menu's own chrome — "Add to order", "Call waiter" — follows the
  // restaurant's chosen language, not the visitor's dashboard preference.
  const locale: Locale = isLocale(data.restaurant.language) ? data.restaurant.language : "en";
  const t = createTranslator(locale);

  return (
    <I18nProvider locale={locale}>
      {/* The menu reads in the restaurant's language regardless of the
          dashboard language the visitor may have chosen. */}
      <div dir={dirOf(locale)} lang={locale}>
    <MenuProvider
      data={data}
      table={table}
      showPrices={showPrices}
      showIngredients={showIngredients}
      staffMode={staffMode}
    >
      {staffMode && (
        <div className="sticky top-0 z-30 bg-emerald-700 px-4 py-2 text-center text-xs font-medium text-white">
          {t("menu.staffMode")}
        </div>
      )}
      {table && (
        <div className="sticky top-0 z-30 bg-ink-900 px-4 py-2 text-center text-xs font-medium text-white">
          {t("menu.youAreAt", { table: table.label })}
        </div>
      )}

      <Theme />

      <ProductSheet />

      {table && (
        <>
          <CartBar slug={data.restaurant.slug} tableToken={tableToken} />
          <WaiterButton
            slug={data.restaurant.slug}
            tableToken={tableToken}
            variant={lightFab ? "light" : "dark"}
          />
        </>
      )}
    </MenuProvider>
      </div>
    </I18nProvider>
  );
}
