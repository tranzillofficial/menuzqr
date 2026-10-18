import type { Metadata } from 'next';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { validateBelmirContent } from '@/lib/belmir/validation';
import { belmirMenuData } from '@/lib/belmir/menu-data';
import { BelmirNativeMenu } from '@/components/menu/BelmirNativeMenu';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { absolute: 'Belmir | Café & Bakery Menu' } };

export default async function BelmirTemplate() {
  const { data, error } = await createAdminSupabase().from('belmir_site_content').select('payload').eq('id', 'belmir').single();
  if (error) throw new Error('The menu is temporarily unavailable.');
  return <BelmirNativeMenu data={belmirMenuData(validateBelmirContent(data.payload), 'modern')} />;
}
