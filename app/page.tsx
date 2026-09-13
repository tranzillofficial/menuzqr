import Image from "next/image";
import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { getUser } from "@/lib/auth";
import { getPlatformSettings } from "@/lib/platform";
import { getT } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n";

export default async function HomePage() {
  const [user, platform, t] = await Promise.all([getUser(), getPlatformSettings(), getT()]);
  const price = platform.priceUsd;

  const features: Array<{ icon: keyof typeof Icon; title: TranslationKey; body: TranslationKey }> = [
    { icon: "palette", title: "landing.f1Title", body: "landing.f1Body" },
    { icon: "qr", title: "landing.f2Title", body: "landing.f2Body" },
    { icon: "receipt", title: "landing.f3Title", body: "landing.f3Body" },
    { icon: "bell", title: "landing.f4Title", body: "landing.f4Body" },
    { icon: "sparkles", title: "landing.f5Title", body: "landing.f5Body" },
    { icon: "image", title: "landing.f6Title", body: "landing.f6Body" },
  ];

  const steps: TranslationKey[] = [
    "landing.step1",
    "landing.step2",
    "landing.step3",
    "landing.step4",
    "landing.step5",
  ];

  const perks: TranslationKey[] = [
    "landing.pricingP1",
    "landing.pricingP2",
    "landing.pricingP3",
    "landing.pricingP4",
    "landing.pricingP5",
    "landing.pricingP6",
  ];

  const faqs: Array<[TranslationKey, TranslationKey]> = [
    ["landing.faq1Q", "landing.faq1A"],
    ["landing.faq2Q", "landing.faq2A"],
    ["landing.faq3Q", "landing.faq3A"],
    ["landing.faq4Q", "landing.faq4A"],
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* ------------------------------------------------------------ header */}
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-ink-900">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">
              <Icon.qr className="size-4.5" />
            </span>
            {platform.brandName}
          </Link>

          <nav className="ms-auto flex items-center gap-2">
            <LocaleSwitch className="hidden sm:inline-flex" />
            {user ? (
              <LinkButton href="/dashboard" size="sm">
                {t("landing.ctaDashboard")}
              </LinkButton>
            ) : (
              <>
                <LinkButton href="/login" variant="ghost" size="sm">
                  {t("landing.signIn")}
                </LinkButton>
                <LinkButton href="/signup" size="sm">
                  {t("landing.getStarted")}
                </LinkButton>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        {/* -------------------------------------------------------------- hero */}
        <section className="relative overflow-hidden border-b border-ink-100">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-50 via-white to-white"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 start-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl rtl:translate-x-1/2"
          />

          <div className="relative mx-auto grid max-w-6xl gap-14 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-700">
                <Icon.sparkles className="size-3.5" />
                {t("landing.badge")}
              </p>

              <h1 className="mt-5 font-serif text-4xl leading-[1.1] text-ink-900 sm:text-5xl lg:text-6xl">
                {t("landing.heroTitle")}
              </h1>

              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600 text-balance-pretty">
                {t("landing.heroBody")}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton href="/signup" size="lg">
                  {t("landing.ctaPrimary")}
                </LinkButton>
                <LinkButton
                  href={platform.supportWhatsappUrl}
                  variant="secondary"
                  size="lg"
                  target="_blank"
                >
                  <Icon.whatsapp className="size-4" />
                  {t("landing.ctaSecondary")}
                </LinkButton>
              </div>

              <p className="mt-4 text-sm text-ink-500">
                {t("landing.priceNote", { price })}
              </p>

              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-600">
                {(["landing.trustSpeed", "landing.trustNoApp", "landing.trustUpdate"] as TranslationKey[]).map(
                  (key) => (
                    <li key={key} className="flex items-center gap-1.5">
                      <Icon.check className="size-4 text-emerald-600" />
                      {t(key)}
                    </li>
                  )
                )}
              </ul>
            </div>

            <HeroShot alt={t("landing.heroAlt")} />
          </div>
        </section>

        {/* ---------------------------------------------------------- features */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <h2 className="font-serif text-3xl text-ink-900 sm:text-4xl">
              {t("landing.featuresTitle")}
            </h2>
            <p className="mt-3 text-ink-600">{t("landing.featuresSub")}</p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Glyph = Icon[feature.icon];
              return (
                <div
                  key={feature.title}
                  className="group rounded-2xl border border-ink-200 bg-white p-6 transition-colors hover:border-brand-300"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                    <Glyph className="size-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-ink-900">{t(feature.title)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{t(feature.body)}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* --------------------------------------------------------------- how */}
        <section className="border-y border-ink-100 bg-ink-50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="font-serif text-3xl text-ink-900 sm:text-4xl">
              {t("landing.howTitle")}
            </h2>

            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {steps.map((step, index) => (
                <li key={step} className="relative">
                  <span className="grid size-9 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  {index < steps.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute top-4 hidden h-px w-[calc(100%-3rem)] bg-ink-200 lg:block"
                      style={{ insetInlineStart: "3rem" }}
                    />
                  )}
                  <p className="mt-4 text-sm leading-relaxed text-ink-700">
                    {t(step, { price })}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ----------------------------------------------------------- pricing */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_420px] lg:items-start">
            <div>
              <h2 className="font-serif text-3xl text-ink-900 sm:text-4xl">
                {t("landing.faqTitle")}
              </h2>
              <div className="mt-6 divide-y divide-ink-200 border-y border-ink-200">
                {faqs.map(([question, answer]) => (
                  <details key={question} className="group py-4">
                    <summary className="flex cursor-pointer list-none items-center gap-3 text-base font-medium text-ink-900">
                      <span className="flex-1">{t(question)}</span>
                      <span className="grid size-6 shrink-0 place-items-center rounded-full border border-ink-200 text-ink-500 transition-transform group-open:rotate-45">
                        <Icon.plus className="size-3.5" />
                      </span>
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-ink-600">{t(answer)}</p>
                  </details>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-ink-200 bg-white p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <p className="text-sm font-medium text-ink-500">{t("landing.pricingLabel")}</p>
              <p className="mt-2 flex items-baseline gap-2 font-serif text-5xl text-ink-900">
                <span className="ltr-nums">${price}</span>
                <span className="font-sans text-base text-ink-500">
                  {t("landing.pricingUnit")}
                </span>
              </p>

              <ul className="mt-6 space-y-2.5 text-sm text-ink-700">
                {perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <Icon.check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    {t(perk)}
                  </li>
                ))}
              </ul>

              <LinkButton href="/signup" size="lg" className="mt-7 w-full">
                {t("landing.pricingCta")}
              </LinkButton>
              <p className="mt-3 text-center text-xs text-ink-500">{t("landing.pricingNote")}</p>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- final CTA */}
        <section className="bg-ink-900">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-20">
            <h2 className="font-serif text-3xl text-white sm:text-4xl">
              {t("landing.finalTitle")}
            </h2>
            <p className="max-w-xl text-white/70">{t("landing.finalBody")}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <LinkButton href="/signup" size="lg">
                {t("landing.ctaPrimary")}
              </LinkButton>
              <a
                href={platform.supportWhatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 px-6 text-base font-medium text-white transition-colors hover:bg-white/10"
              >
                <Icon.whatsapp className="size-4" />
                {t("landing.ctaSecondary")}
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {new Date().getFullYear()} {platform.brandName}. {t("landing.footerRights")}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <LocaleSwitch />
          <a
            href={platform.supportWhatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 hover:text-ink-800"
          >
            <Icon.whatsapp className="size-4" />
            <span className="ltr-nums">{platform.supportWhatsappDisplay}</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

/**
 * The hero artwork: a rendered phone already carrying its own frame, shadow and
 * transparent background, so nothing is drawn around it here.
 *
 * `priority` because this is the largest element above the fold — without it
 * Next lazy-loads the image and the page visibly pops in.
 */
function HeroShot({ alt }: { alt: string }) {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-brand-200/50 to-transparent blur-2xl"
      />
      <Image
        src="/hero.png"
        alt={alt}
        width={1052}
        height={1495}
        priority
        sizes="(min-width: 1024px) 24rem, (min-width: 640px) 60vw, 85vw"
        className="relative h-auto w-full"
      />
    </div>
  );
}
