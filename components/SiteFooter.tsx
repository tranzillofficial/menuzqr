import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";
import { getPlatformSettings } from "@/lib/platform";
import { infoPages } from "@/lib/info-pages";
import { Icon } from "@/components/ui/Icons";

export async function SiteFooter() {
  const [locale, platform] = await Promise.all([getLocale(), getPlatformSettings()]);
  const ar = locale === "ar";

  return (
    <footer className="border-t border-ink-800 bg-ink-900 text-white">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.9fr_0.9fr]">
          <div className="max-w-md">
            <Link href="/" className="inline-flex items-center gap-2.5 text-lg font-semibold text-white">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
                <Icon.qr className="size-4.5" />
              </span>
              <span>{platform.brandName}</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-7 text-ink-300">
              {ar
                ? "منيو إلكتروني، أكواد QR، طلبات الطاولات ونقطة بيع بسيطة في مكان واحد."
                : "Digital menus, QR codes, table ordering and a simple point of sale in one place."}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-white">
              {ar ? "معلومات مهمة" : "Important information"}
            </h2>
            <nav
              aria-label={ar ? "معلومات الموقع" : "Site information"}
              className="mt-3 grid gap-2.5 text-sm text-ink-300"
            >
              {Object.entries(infoPages).map(([slug, page]) => (
                <Link
                  key={slug}
                  href={`/${slug}`}
                  className="w-fit py-0.5 transition-colors hover:text-brand-300"
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
            <div className="mt-3 grid gap-2.5 text-sm">
              <a
                href={platform.supportWhatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-2 font-medium text-brand-300 transition-colors hover:text-brand-200"
              >
                <Icon.whatsapp className="size-4 shrink-0" />
                {ar ? "تواصل مع الدعم على واتساب" : "Contact support on WhatsApp"}
              </a>
              {platform.supportEmail && (
                <a
                  href={`mailto:${platform.supportEmail}`}
                  className="w-fit max-w-full break-all text-ink-300 transition-colors hover:text-white"
                >
                  {platform.supportEmail}
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-5">
          <p className="text-xs leading-6 text-ink-400">
            © {new Date().getFullYear()} {platform.brandName}.{" "}
            {ar ? "كل الحقوق محفوظة." : "All rights reserved."}
          </p>
        </div>
      </div>
    </footer>
  );
}
