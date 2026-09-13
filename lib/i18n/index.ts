import { ar } from "./ar";
import { en, type TranslationKey } from "./en";

export type Locale = "en" | "ar";

export const LOCALES: Locale[] = ["en", "ar"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "mz_locale";

export const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = {
  en,
  ar,
};

export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ar";
}

export function dirOf(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export type Vars = Record<string, string | number>;

/** Replaces `{name}` placeholders. Unknown placeholders are left alone. */
export function interpolate(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  );
}

export type Translator = (key: TranslationKey, vars?: Vars) => string;

export function createTranslator(locale: Locale): Translator {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  return (key, vars) => interpolate(dict[key] ?? en[key] ?? key, vars);
}

export type { TranslationKey };
