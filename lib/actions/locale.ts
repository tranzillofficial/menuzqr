"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";

/** Stores the interface language for a year. Menu content is never translated. */
export async function setLocaleAction(value: string): Promise<{ ok: boolean }> {
  if (!isLocale(value)) return { ok: false };

  const store = await cookies();
  store.set(LOCALE_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
