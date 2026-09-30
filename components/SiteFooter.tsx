import Link from 'next/link';
import { getLocale } from '@/lib/i18n/server';
import { getPlatformSettings } from '@/lib/platform';
import { LocaleSwitch } from '@/components/i18n/LocaleSwitch';
import { infoPages } from '@/lib/info-pages';
export async function SiteFooter() {
  const [locale, platform] = await Promise.all([getLocale(), getPlatformSettings()]);
  return <footer className="border-t border-ink-200 bg-ink-50"><div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><Link href="/" className="text-lg font-semibold text-ink-900">{platform.brandName}</Link><LocaleSwitch /></div>
    <nav aria-label={locale === 'ar' ? 'معلومات الموقع' : 'Site information'} className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink-600">{Object.entries(infoPages).map(([slug, page]) => <Link key={slug} href={`/${slug}`} className="py-1 hover:text-brand-700">{page[locale]}</Link>)}</nav>
    <div className="flex flex-wrap gap-4 text-sm"><a href={platform.supportWhatsappUrl} target="_blank" rel="noreferrer" className="text-brand-700">{locale === 'ar' ? 'تواصل مع الدعم' : 'Contact support'}</a>{platform.supportEmail && <a href={`mailto:${platform.supportEmail}`} className="break-all text-ink-600">{platform.supportEmail}</a>}</div>
    <p className="text-xs text-ink-500">© {new Date().getFullYear()} {platform.brandName}. {locale === 'ar' ? 'كل الحقوق محفوظة.' : 'All rights reserved.'}</p>
  </div></footer>;
}
