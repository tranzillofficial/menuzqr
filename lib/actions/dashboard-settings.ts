"use server";
import {revalidatePath,revalidateTag} from 'next/cache';
import {getOwnedRestaurant,str,bool,fail,done} from './helpers';
import {createServerSupabase} from '@/lib/supabase/server';
import {normalizeWhatsapp} from '@/lib/phone';
import type {ActionState} from '@/lib/types';
export async function saveDashboardSettings(_prev:ActionState,form:FormData):Promise<ActionState>{
 const owned=await getOwnedRestaurant('settings');if(!owned.ok)return owned.error;
 const fields=['cash_wallet','instapay_address','payment_details','free_delivery_above','location_url','facebook_url','instagram_url','website_url'];
 const payload:Record<string,string|boolean|number>={};for(const key of fields)payload[key]=str(form,key);
 payload.payment_whatsapp=normalizeWhatsapp(str(form,'payment_whatsapp'));
 for(const key of ['sound_enabled','show_prices','show_ingredients','ordering_enabled','waiter_calls_enabled','remote_ordering_enabled'])payload[key]=bool(form,key);
 payload.delivery_fee=Number(str(form,'delivery_fee'));
 for(const key of ['location_url','facebook_url','instagram_url','website_url'])if(payload[key]){try{const url=new URL(String(payload[key]));if(url.protocol!=='https:'||url.username||url.password)throw Error();}catch{return fail('اكتب رابطًا صحيحًا يبدأ بـ https://. Enter a valid HTTPS URL.');}}
 const db=await createServerSupabase();
 // Contact links are edited in Profile; display/payment saves must retain the latest values.
 const current=await db.from('restaurant_settings').select('location_url,facebook_url,instagram_url,website_url').eq('restaurant_id',owned.restaurant.id).maybeSingle();
 if(current.error)return fail('تعذر تحميل بيانات البروفايل. حاول مرة أخرى. Could not load profile.');
 for(const key of ['location_url','facebook_url','instagram_url','website_url'] as const)payload[key]=current.data?.[key]??'';
 const {error}=await db.rpc('save_dashboard_settings',{p_restaurant:owned.restaurant.id,p_settings:payload});
 if(error)return fail('تعذر الحفظ. راجع أرقام الدفع والروابط ورسوم التوصيل. لتفعيل طلبات التحويل أضف بيانات الدفع وواتساب. Could not save; check payment details, links and delivery fees.');
 revalidatePath('/dashboard/settings');revalidatePath('/dashboard/qr-codes');revalidatePath(`/${owned.restaurant.slug}/menu`);revalidateTag(`menu-products:${owned.restaurant.slug}`,'max');return done('تم حفظ التعديلات. Changes saved.');
}
