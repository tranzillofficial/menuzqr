import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";
import { getPlatformSettings } from "@/lib/platform";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { infoPages } from "@/lib/info-pages";
import { Icon } from "@/components/ui/Icons";

export async function SiteFooter() {
  const [locale, platform] = await Promise.all([getLocale(), getPlatformSettings()]);
  const ar = locale === "ar";

  return (
    <footer className="border-t border-ink-200 bg-ink-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-8 md:grid-cols-[1.1fr_1fr_1fr]">
          <div className="max-w-sm">
            <Link href="/" className="inline-flex items-center gap-2 text-lg font-semibold">
              <span className="grid size-9 place-items-center rounded-xl bg-brand-600 text-white">
                <Icon.qr className="size-4.5" />
              </span>
              <span>{platform.brandName}</span>
            </Link>
            <p className="mt-3 text-sm leading-6 text-white/65">
              {ar
                ? "منيو إلكتروني وكود QR وطلبات الطاولات ونقطة بيع بسيطة في مكان واحد."
                : "Digital menus, QR codes, table ordering and a simple point of sale in one place."}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-white">
              {ar ? "معلومات مهمة" : "Important information"}
            </h2>
            <nav
              aria-label={ar ? "معلومات الموقع" : "Site information"}
              className="mt-3 grid gap-2 text-sm text-white/65"
            >
              {Object.entries(infoPages).map(([slug, page]) => (
                <Link
                  key={slug}
                  href={`/${slug}`}
                  className="w-fit py-0.5 transition-colors hover:text-white"
                >
                  {page[locale]}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-white">
              {ar ? "الدعم والتواصل" : "Support"}
            </h2>
            <div className="mt-3 grid gap-2 text-sm">
              <a
                href={platform.supportWhatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-2 text-white/70 transition-colors hover:text-white"
              >
                <Icon.whatsapp className="size-4" />
                {ar ? "تواصل معانا على واتساب" : "Chat with us on WhatsApp"}
              </a>
              {platform.supportEmail && (
                <a
                  href={`mailto:${platform.supportEmail}`}
                  className="w-fit break-all text-white/65 transition-colors hover:text-white"
                >
                  {platform.supportEmail}
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
          <p className="text-xs text-white/45">
            © {new Date().getFullYear()} {platform.brandName}.{" "}
            {ar ? "كل الحقوق محفوظة." : "All rights reserved."}
          </p>
          <LocaleSwitch />
        </div>
      </div>
    </footer>
  );
}
