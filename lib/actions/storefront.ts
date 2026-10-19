"use server";
import {revalidatePath} from 'next/cache';
import {featureEnabled} from '@/lib/business-features';
import {createServerSupabase} from '@/lib/supabase/server';
import {getOwnedRestaurant,str,done,fail} from './helpers';
import type {ActionState} from '@/lib/types';
export async function saveStorefrontDetails(_prev:ActionState,form:FormData):Promise<ActionState>{
 const owned=await getOwnedRestaurant('settings');if(!owned.ok)return owned.error;
 const patch:Record<string,string|number|null>={};
 if(featureEnabled(owned.restaurant,'delivery_settings')){
  const fee=Number(str(form,'delivery_fee')),raw=str(form,'free_delivery_above'),free=raw?Number(raw):null;
  if(!Number.isFinite(fee)||fee<0||fee>100000||(free!==null&&(!Number.isFinite(free)||free<0||free>1000000)))return fail('راجع رسوم التوصيل. Invalid delivery fee.');
  patch.delivery_fee=Math.round(fee*100)/100;patch.free_delivery_above=free===null?null:Math.round(free*100)/100;
 }
 if(featureEnabled(owned.restaurant,'payment_settings'))patch.payment_details=str(form,'payment_details').slice(0,1200);
 if(featureEnabled(owned.restaurant,'contact_settings'))for(const key of ['whatsapp_url','facebook_url','instagram_url','tiktok_url','website_url','location_url']){
  const value=str(form,key);if(value){try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||value.length>500)throw Error();}catch{return fail('اكتب رابطًا يبدأ بـ https://. Enter a valid HTTPS URL.');}}patch[key]=value;
 }
 const db=await createServerSupabase();const {error}=await db.from('restaurant_settings').upsert({restaurant_id:owned.restaurant.id,...patch},{onConflict:'restaurant_id'});
 if(error)return fail('تعذر الحفظ. Could not save.');revalidatePath('/dashboard/settings');revalidatePath(`/${owned.restaurant.slug}/menu`);return done('تم حفظ الإعدادات. Settings saved.');
}
