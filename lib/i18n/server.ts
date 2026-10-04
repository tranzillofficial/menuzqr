import "server-only";

import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  createTranslator,
  isLocale,
  type Locale,
  type Translator,
} from "./index";

/** The visitor's chosen interface language, from the cookie the switcher sets. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getT(): Promise<Translator> {
  return createTranslator(await getLocale());
}

export async function getBusinessT(): Promise<Translator> {
  const { getMembership } = await import("@/lib/membership");
  const { moduleEnabled } = await import("@/lib/business-modules");
  const membership = await getMembership();
  const r = membership?.restaurant;
  return createTranslator(await getLocale(), r?.enabled_modules != null && !moduleEnabled(r,"tables"));
}
