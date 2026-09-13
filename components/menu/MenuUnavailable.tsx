import Link from "next/link";
import { getPlatformSettings } from "@/lib/platform";
import { createTranslator, dirOf, isLocale, type Locale } from "@/lib/i18n";

export async function MenuUnavailable({
  restaurantName,
  status,
  language,
  reason,
}: {
  restaurantName: string;
  status: "inactive" | "active" | "suspended";
  /** The restaurant's own language — the guest is reading their menu, not ours. */
  language: string;
  reason?: string;
}) {
  const platform = await getPlatformSettings();
  const locale: Locale = isLocale(language) ? language : "en";
  const t = createTranslator(locale);

  const message =
    reason ??
    (status === "suspended"
      ? t("menu.unavailableSuspended")
      : status === "active"
        ? t("menu.unavailablePreparing")
        : t("menu.unavailableTitle"));

  return (
    <main
      dir={dirOf(locale)}
      lang={locale}
      className="flex min-h-screen items-center justify-center bg-ink-50 px-5 py-12"
    >
      <div className="w-full max-w-md rounded-3xl border border-ink-200 bg-white p-8 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-ink-100 text-3xl">
          🍽️
        </div>
        <h1 className="mt-5 text-xl font-semibold text-ink-900">{restaurantName}</h1>
        <p className="mt-2 text-sm text-ink-600">{message}</p>
        <p className="mt-1 text-sm text-ink-500">{t("menu.askStaff")}</p>

        <div className="mt-8 border-t border-ink-100 pt-6">
          <p className="text-xs text-ink-400">{t("menu.ownerNote")}</p>
          <div className="mt-3 flex flex-col gap-2">
            <a
              href={platform.supportWhatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white"
            >
              <span className="ltr-nums">WhatsApp {platform.supportWhatsappDisplay}</span>
            </a>
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-ink-200 px-4 text-sm font-medium text-ink-700"
            >
              {t("nav.dashboard")}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
