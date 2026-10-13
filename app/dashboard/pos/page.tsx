import {featureEnabled} from "@/lib/business-features";
import { activeOrders } from '@/lib/order-data';
import { IncomingOrders } from '@/components/dashboard/IncomingOrders';
import { moduleEnabled } from '@/lib/business-modules';
import Link from 'next/link';
import { requireManager } from '@/lib/membership';
import { getPlatformSettings } from '@/lib/platform';
import { getLocale } from '@/lib/i18n/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasPosAccess } from '@/lib/pos';
import { PosScreen } from '@/components/dashboard/PosScreen';
import type { ProductWithVariants,Category,RestaurantTable } from '@/lib/types';
export const metadata={title:'POS'};
export default async function PosPage(){
 const [member,platform,locale]=await Promise.all([requireManager('/dashboard/pos'),getPlatformSettings(),getLocale()]);
 const ar=locale==='ar';
 if(!hasPosAccess(member.restaurant,platform.posEnabled)) return <div className="mx-auto max-w-xl rounded-3xl border border-ink-200 bg-white p-8"><h1 className="text-2xl font-semibold">{ar?'الكاشير':'Point of sale'}</h1><p className="my-4 text-ink-600">{ar?`سجّل مبيعاتك واطبع الفاتورة من مكان واحد. أول ${platform.posTrialDays} يوم مجانًا مع تفعيل المنيو.`:`Record sales and print receipts in one place. Your first ${platform.posTrialDays} days are included with menu activation.`}</p><Link className="inline-flex rounded-xl bg-brand-600 px-5 py-3 text-white" href="/dashboard/billing">{ar?'تفاصيل الاشتراك':'Subscription details'}</Link></div>;
 const db=await createServerSupabase();
 const [products,categories,tables]=await Promise.all([db.from('products').select('*,product_variants(*)').eq('restaurant_id',member.restaurant.id).eq('is_active',true).order('sort_order').order('id').range(0,40),db.from('categories').select('*').eq('restaurant_id',member.restaurant.id).eq('is_active',true).order('sort_order'),moduleEnabled(member.restaurant,'tables')?db.from('restaurant_tables').select('*').eq('restaurant_id',member.restaurant.id).eq('is_active',true).order('sort_order'):Promise.resolve({data:[],error:null})]);
 if(products.error||categories.error||tables.error) throw new Error('Could not load POS');
 const incoming=moduleEnabled(member.restaurant,"orders")?await activeOrders(member.restaurant.id,true):[];
 return <>{moduleEnabled(member.restaurant,"orders")&&<IncomingOrders orders={incoming} retail={member.restaurant.enabled_modules != null && !moduleEnabled(member.restaurant,"tables")}/>}<PosScreen printingEnabled={featureEnabled(member.restaurant,"receipt_printing")} barcodeEnabled={featureEnabled(member.restaurant,"product_barcode")} tablesEnabled={moduleEnabled(member.restaurant,"tables")} restaurantId={member.restaurant.id} restaurantName={member.restaurant.name} currency={member.restaurant.currency} initialHasMore={(products.data??[]).length>40} products={(products.data??[]).slice(0,40) as ProductWithVariants[]} categories={(categories.data??[]) as Category[]} tables={(tables.data??[]) as RestaurantTable[]} taxSettings={member.restaurant} /></>;
}
