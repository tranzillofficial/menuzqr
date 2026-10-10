"use client";

import { useMemo, useRef, useState } from 'react';
import { MENU_THEMES, type MenuThemeId } from '@/lib/constants';
import { localizeMenu } from '@/lib/menu-localization';

import { SupermarketMenu } from "./themes/SupermarketMenu";
import { RetailMenu } from "./themes/RetailMenu";
import { moduleEnabled } from "@/lib/business-modules";
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
import { dirOf, isLocale, createTranslator, type Locale, type TranslationKey } from "@/lib/i18n";
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
  offersOnly = false,
}: {
  data: MenuData;
  table: { id: string; label: string } | null;
  tableToken: string;
  showPrices: boolean;
  showIngredients: boolean;
  staffMode?: boolean;
  offersOnly?: boolean;
}) {
  const isDemo = data.restaurant.slug === "demo";
  const [previewTheme, setPreviewTheme] = useState<MenuThemeId>(data.restaurant.menu_theme);
  const pickerRef = useRef<HTMLDetailsElement>(null);
  const menuTheme = isDemo ? previewTheme : data.restaurant.menu_theme;
  const Theme = data.restaurant.business_kind === "supermarket" ? SupermarketMenu : moduleEnabled(data.restaurant,"subcategories") ? RetailMenu : THEMES[menuTheme] ?? ElegantMenu;
  const lightFab = menuTheme === "elegant" || menuTheme === "market";

  // Start with the merchant's language; visitors can change their menu view
  // without changing account settings or losing their basket.
  const [locale, setLocale] = useState<Locale>(isLocale(data.restaurant.language) ? data.restaurant.language : "ar");
  const localizedData = useMemo(() => localizeMenu({ ...data, restaurant: { ...data.restaurant, menu_theme: menuTheme } }, locale), [data, locale, menuTheme]);
  const t = createTranslator(locale);

  return (
    <I18nProvider locale={locale} retail={data.restaurant.enabled_modules != null && !moduleEnabled(data.restaurant,"tables")}>
      <div dir={dirOf(locale)} lang={locale}>
      <nav aria-label={locale === 'ar' ? 'لغة المينيو' : 'Menu language'} className="flex justify-end gap-1 border-b border-ink-100 bg-white px-3 py-2">
        {isDemo && (
          <details ref={pickerRef} className="relative me-auto self-center" onKeyDown={event => { if (event.key === 'Escape' && pickerRef.current) { pickerRef.current.open = false; pickerRef.current.querySelector('summary')?.focus(); } }}>
            <summary className="cursor-pointer rounded-full border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-700 focus-visible:outline-2 focus-visible:outline-brand-500">
              {locale === 'ar' ? 'غيّر التصميم' : 'Change design'}
            </summary>
            <div className="absolute start-0 top-full z-50 mt-2 w-56 rounded-2xl border border-ink-200 bg-white p-2 text-ink-900 shadow-xl">
              {MENU_THEMES.map(theme => (
                <button key={theme.id} type="button" aria-pressed={menuTheme === theme.id} onClick={() => { setPreviewTheme(theme.id); if (pickerRef.current) { pickerRef.current.open = false; pickerRef.current.querySelector('summary')?.focus(); } }} className={`flex w-full items-center gap-2 rounded-xl px-3 py-3 text-start text-sm ${menuTheme === theme.id ? 'bg-ink-900 text-white' : 'hover:bg-ink-50'}`}>
                  <span className="flex gap-0.5" aria-hidden="true">{theme.swatch.map(colour => <span key={colour} className="size-3 rounded-full ring-1 ring-black/10" style={{ backgroundColor: colour }} />)}</span>
                  {t(`theme.${theme.id}.name` as TranslationKey)}
                  {menuTheme === theme.id && <span className="ms-auto" aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          </details>
        )}
        {(['ar', 'en'] as const).map(language => <button key={language} type="button" lang={language} aria-pressed={locale === language} onClick={() => setLocale(language)} className={`rounded-full px-4 py-2 text-xs font-semibold ${locale === language ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-600'}`}>{language === 'ar' ? 'العربية' : 'English'}</button>)}
      </nav>
    <MenuProvider
      data={localizedData}
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

      {data.restaurant.business_kind === "supermarket" ? <SupermarketMenu offersOnly={offersOnly}/> : <Theme />}

      <ProductSheet />

      <CartBar slug={data.restaurant.slug} tableToken={tableToken} />
      {table && (
        <>
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
