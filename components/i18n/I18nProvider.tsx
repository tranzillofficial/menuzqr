"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, dirOf, type Locale, type Translator } from "@/lib/i18n";

type I18nValue = { locale: Locale; t: Translator; dir: "ltr" | "rtl" };

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({ locale, t: createTranslator(locale), dir: dirOf(locale) }),
    [locale]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Client-side translator. Falls back to English rather than throwing, so a
 * component rendered outside a provider still shows readable text.
 */
export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  return (
    value ?? { locale: "en", t: createTranslator("en"), dir: "ltr" }
  );
}

export function useT(): Translator {
  return useI18n().t;
}
