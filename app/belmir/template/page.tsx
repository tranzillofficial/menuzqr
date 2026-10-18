import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MENU_THEME_IDS, type MenuThemeId } from '@/lib/constants';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { validateBelmirContent } from '@/lib/belmir/validation';
import { belmirMenuData } from '@/lib/belmir/menu-data';
import { BelmirNativeMenu } from '@/components/menu/BelmirNativeMenu';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { absolute: 'Belmir | Café & Bakery Menu' } };

export default async function BelmirTemplate({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const { theme } = await searchParams;
  if (!MENU_THEME_IDS.includes(theme as MenuThemeId)) notFound();
  const { data, error } = await createAdminSupabase().from('belmir_site_content').select('payload').eq('id', 'belmir').single();
  if (error) throw new Error('The menu is temporarily unavailable.');
  return <BelmirNativeMenu data={belmirMenuData(validateBelmirContent(data.payload), theme as MenuThemeId)} />;
}
