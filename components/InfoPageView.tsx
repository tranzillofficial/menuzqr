import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale } from '@/lib/i18n/server';
import { getPlatformSettings } from '@/lib/platform';
import { infoPages, type InfoPage } from '@/lib/info-pages';
import { SiteFooter } from '@/components/SiteFooter';
export async function InfoPageView({ info }: { info: InfoPage }) {
  if (!Object.hasOwn(infoPages, info)) notFound();
  const page = infoPages[info as InfoPage];
  const [locale, platform] = await Promise.all([getLocale(), getPlatformSettings()]);
  const ar = locale === 'ar';
  return <div className="min-h-screen bg-white"><header className="border-b border-ink-100"><div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5"><Link href="/" className="font-semibold">{platform.brandName}</Link><Link href="/" className="text-sm text-brand-700">{ar ? 'الصفحة الرئيسية' : 'Home'}</Link></div></header><main className="mx-auto max-w-3xl px-5 py-12"><h1 className="mb-8 text-3xl font-semibold">{page[locale]}</h1><div className="space-y-8">{page.sections.map(([at, et, ab, eb]) => <section key={et}><h2 className="mb-3 text-lg font-semibold">{ar ? at : et}</h2><p className="leading-8 text-ink-600">{ar ? ab : eb}</p></section>)}</div>{info === 'contact' && <div className="mt-8 space-y-4 rounded-2xl bg-brand-50 p-5"><a className="block text-brand-800" href={platform.supportWhatsappUrl}>{ar ? 'واتساب الدعم' : 'WhatsApp support'} <bdi>{platform.supportWhatsappDisplay}</bdi></a>{platform.supportEmail && <a className="block break-all" href={`mailto:${platform.supportEmail}`}>{platform.supportEmail}</a>}</div>}</main><SiteFooter /></div>;
}
