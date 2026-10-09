import {notFound} from 'next/navigation';
import {getPublicMenu} from '@/lib/menu-data';
import {MenuExperience} from '@/components/menu/MenuExperience';
import {MenuUnavailable} from '@/components/menu/MenuUnavailable';
import {createAdminSupabase} from '@/lib/supabase/admin';
export const dynamic='force-dynamic';
export default async function OffersPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const result=await getPublicMenu(slug);if(result.state==='not_found')notFound();
 if(result.state==='inactive')return <MenuUnavailable restaurantName={result.restaurantName} status={result.status} language={result.language}/>;
 if(result.data.restaurant.business_kind!=='supermarket')notFound();
 const {data:settings}=await createAdminSupabase().from('restaurant_settings').select('show_prices').eq('restaurant_id',result.data.restaurant.id).maybeSingle();
 return <MenuExperience data={result.data} table={null} tableToken="" showPrices={settings?.show_prices??true} showIngredients={false} offersOnly/>;
}
