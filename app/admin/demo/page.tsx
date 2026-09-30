import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getPlatformSettings } from '@/lib/platform';
import { getLocale } from '@/lib/i18n/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { ThemePicker } from '@/components/dashboard/ThemePicker';
import type { MenuThemeId } from '@/lib/constants';

export const metadata = { title: 'Demo menu design' };

export default async function DemoDesignPage() {
  await requireAdmin();
  const [platform, locale, db] = await Promise.all([getPlatformSettings(), getLocale(), createServerSupabase()]);
  const { data, error } = await db.from('restaurants').select('name,slug,menu_theme,status')
    .eq('slug', platform.demoRestaurantSlug).maybeSingle();
  if (error) throw new Error('Could not load demo menu');
  const ar = locale === 'ar';
  return <div className="mx-auto max-w-5xl space-y-5">
    <div><h1 className="text-xl font-semibold">{ar ? 'تصميم المنيو التجريبي' : 'Demo menu design'}</h1>
      <p className="mt-2 text-sm text-ink-500">{ar ? 'اختار التصميم اللي الزوار هيشوفوه لما يفتحوا المنيو التجريبي.' : 'Choose the design visitors see when they open the demo menu.'}</p></div>
    {data ? <><p className="text-sm text-ink-600">{data.name} · /{data.slug}/menu</p>
      <ThemePicker key={data.slug} current={data.menu_theme as MenuThemeId} slug={data.slug} isActive={data.status === 'active'} adminDemo /></>
      : <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <p>{ar ? 'المنيو التجريبي المحدد مش موجود. اختار رابط مطعم موجود من إعدادات المنصة.' : 'The configured demo menu does not exist. Select an existing restaurant slug in platform settings.'}</p>
        <Link href="/admin/platform" className="mt-3 inline-block text-brand-700">{ar ? 'إعدادات المنصة' : 'Platform settings'}</Link>
      </div>}
  </div>;
}
