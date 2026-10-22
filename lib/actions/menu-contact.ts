"use server";
import {revalidatePath} from 'next/cache';
import {createAdminSupabase} from '@/lib/supabase/admin';
import {getMenuRestaurant,str,fail,done,sanitiseImageUrl} from './helpers';
import {contactPhones,safeContactUrl} from '@/lib/menu-contact';
import {coverDisplay} from '@/lib/menu-cover';
import {featureEnabled} from '@/lib/business-features';
import {normalizeWhatsapp} from '@/lib/phone';
import type {ActionState} from '@/lib/types';
export async function saveMenuContact(_previous:ActionState,form:FormData):Promise<ActionState>{
 const owned=await getMenuRestaurant('settings');if(!owned.ok)return owned.error;
 const logoInput=form.has('logo_url')?(str(form,'logo_url')||null):owned.restaurant.logo_url,coverInput=form.has('cover_url')?(str(form,'cover_url')||null):owned.restaurant.cover_url;
 const logo=sanitiseImageUrl(logoInput),cover=sanitiseImageUrl(coverInput);
 if((logoInput&&!logo)||(coverInput&&!cover))return fail('صورة غير صالحة. ارفع الصورة من جديد. Invalid image. Please upload it again.');
 const display=coverDisplay({cover_fit:form.has('cover_fit')?(str(form,'cover_fit')==='cover'?'cover':'contain'):owned.restaurant.cover_fit,cover_position_x:form.has('cover_position_x')?Number(str(form,'cover_position_x')):owned.restaurant.cover_position_x,cover_position_y:form.has('cover_position_y')?Number(str(form,'cover_position_y')):owned.restaurant.cover_position_y});
 const raw=str(form,'contact_phones').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 const phones=contactPhones(raw);if(raw.length>10||raw.some(s=>contactPhones([s]).length!==1))return fail('راجع أرقام الاتصال. أضف كل رقم في سطر منفصل، بحد أقصى 10 أرقام.');
 const whatsapp=normalizeWhatsapp(str(form,'payment_whatsapp'));if(whatsapp&&!/^\d{8,15}$/.test(whatsapp))return fail('راجع رقم الواتساب وكود الدولة.');
 const links:Record<string,string>={};for(const key of ['location_url','instagram_url','facebook_url','website_url']){const value=str(form,key);if(value&&(value.length>500||!safeContactUrl(value)))return fail('روابط التواصل لازم تبدأ بـ https://.');links[key]=value;}
 // Tenant and permission come exclusively from the authenticated manager context.
 const db=createAdminSupabase();
 const contactsEnabled=featureEnabled(owned.restaurant,'contact_settings');
 if(contactsEnabled){const settings=await db.from('restaurant_settings').upsert({restaurant_id:owned.restaurant.id,...links,payment_whatsapp:whatsapp},{onConflict:'restaurant_id'});if(settings.error)return fail('تعذر حفظ روابط التواصل.');}
 const result=await db.from('restaurants').update({...(contactsEnabled?{contact_phones:phones,phone:phones[0]??null,address:str(form,'address').slice(0,400)||null}:{}),logo_url:logo,cover_url:cover,cover_fit:display.fit,cover_position_x:display.x,cover_position_y:display.y}).eq('id',owned.restaurant.id);
 if(result.error)return fail('تم حفظ الروابط، لكن تعذر حفظ بيانات النشاط. حاول الحفظ مرة أخرى.');
 revalidatePath('/dashboard','layout');revalidatePath(`/${owned.restaurant.slug}/menu`);return done('تم حفظ بيانات المنيو والتواصل.');
}
