"use server";
import {revalidatePath} from 'next/cache';
import {getMenuRestaurant,done,fail,str,bool,sanitiseImageUrl,optionalStr} from './helpers';
import {createServerSupabase} from '@/lib/supabase/server';
import {businessDayRange} from '@/lib/business-time';
import type {ActionState} from '@/lib/types';
export async function saveOffer(_previous:ActionState,form:FormData):Promise<ActionState>{
 const owned=await getMenuRestaurant('offers');if(!owned.ok)return owned.error;const {restaurant}=owned;
 const id=str(form,'id'),title=str(form,'title'),description=str(form,'description'),product_ids=[...new Set(form.getAll('product_ids').filter((v):v is string=>typeof v==='string'))];
 if(title.length<2||title.length>100||description.length>1200||product_ids.length>100)return fail('راجع عنوان العرض ووصفه والمنتجات المختارة.');
 const db=await createServerSupabase();
 if(product_ids.length){const {data,error}=await db.from('products').select('id').eq('restaurant_id',restaurant.id).in('id',product_ids);if(error||data?.length!==product_ids.length)return fail('اختار منتجات من نفس المحل.');}
 let starts_at:string|null=null,ends_at:string|null=null;
 try {if(str(form,'starts_on'))starts_at=businessDayRange(str(form,'starts_on'),restaurant.business_timezone).start;if(str(form,'ends_on'))ends_at=businessDayRange(str(form,'ends_on'),restaurant.business_timezone).end;}catch{return fail('التاريخ غير صحيح.');}
 if(starts_at&&ends_at&&starts_at>=ends_at)return fail('تاريخ النهاية يجب ألا يسبق البداية.');
 const payload={restaurant_id:restaurant.id,title,description,product_ids,image_url:sanitiseImageUrl(optionalStr(form,'image_url')),starts_at,ends_at,is_active:bool(form,'is_active')};
 const query=id?db.from('business_offers').update(payload).eq('id',id).eq('restaurant_id',restaurant.id):db.from('business_offers').insert(payload);
 const {data,error}=await query.select('id').maybeSingle();if(error||!data)return fail('تعذر حفظ العرض.');
 revalidatePath('/dashboard/offers');revalidatePath(`/${restaurant.slug}/menu`);revalidatePath(`/${restaurant.slug}/offers`);return done('تم حفظ العرض.');
}
