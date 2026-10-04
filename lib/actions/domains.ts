"use server";
import {revalidatePath} from 'next/cache';
import {assertAdmin,done,fail,str} from './helpers';
import {createServerSupabase} from '@/lib/supabase/server';
import {normalizeDomain} from '@/lib/domain-names';
import {registerDomain,inspectDomain} from '@/lib/vercel-domains';
import type {ActionState} from '@/lib/types';
export async function saveDomain(_prev:ActionState,form:FormData):Promise<ActionState>{
 const admin=await assertAdmin();if(!admin.ok)return admin.error;
 const db=await createServerSupabase(),id=str(form,'restaurant_id'),hostname=normalizeDomain(str(form,'hostname'));
 if(!hostname)return fail('اكتب دومين صحيح بدون https أو مسار. دومين المنصة محجوز.');
 const mode=str(form,'home_mode');if(!['landing','login'].includes(mode))return fail('اختار الصفحة الرئيسية.');
 const {data:existing,error:lookup}=await db.from('business_domains').select('id,restaurant_id').eq('hostname',hostname).maybeSingle();
 if(lookup)return fail('تعذر التحقق من الدومين.');
 if(existing&&existing.restaurant_id!==id)return fail('الدومين مرتبط بحساب تاني.');
 const payload={hostname,restaurant_id:id,home_mode:mode};
 const {error}=existing?await db.from('business_domains').update(payload).eq('id',existing.id).eq('restaurant_id',id):await db.from('business_domains').insert(payload);
 if(error)return fail('تعذر حفظ الدومين.');
 await db.from('admin_actions').insert({restaurant_id:id,admin_id:admin.userId,action:'domain:saved',notes:hostname});
 revalidatePath(`/admin/restaurants/${id}`);return done('تم الحفظ. اضغط ربط وفحص لاستكمال التحقق من Vercel وDNS.');
}
export async function checkDomain(_prev:ActionState,form:FormData):Promise<ActionState>{
 const admin=await assertAdmin();if(!admin.ok)return admin.error;
 const db=await createServerSupabase();const {data:d}=await db.from('business_domains').select('*').eq('id',str(form,'domain_id')).single();
 if(!d)return fail('الدومين غير موجود.');
 const token=process.env.VERCEL_TOKEN||str(form,'vercel_token');
 if(!token)return fail('لإتمام الربط أضف VERCEL_TOKEN على السيرفر، أو أدخله في خانة الربط الآمن هنا. التوكن لا يُحفظ.');
 try{
  await registerDomain(d.hostname,token);const result=await inspectDomain(d.hostname,token);
  const {error}=await db.from('business_domains').update({status:result.active?'active':'pending',verification:result.details,checked_at:new Date().toISOString()}).eq('id',d.id);
  if(error)return fail('تعذر حفظ نتيجة التحقق.');
  await db.from('admin_actions').insert({restaurant_id:d.restaurant_id,admin_id:admin.userId,action:'domain:checked',notes:d.hostname});
  revalidatePath(`/admin/restaurants/${d.restaurant_id}`);
  return done(result.active?'الدومين اتربط واتفعّل.':'الدومين مسجل على Vercel. عدّل DNS بالقيم المعروضة ثم اضغط فحص مرة تانية.');
 }catch(error){return fail(error instanceof Error?error.message:'تعذر الاتصال بـVercel.');}
}
export async function toggleDomain(form:FormData){
 const admin=await assertAdmin();if(!admin.ok)return;
 const db=await createServerSupabase();const {data:d}=await db.from('business_domains').update({enabled:str(form,'enabled')==='true'}).eq('id',str(form,'domain_id')).select('restaurant_id,hostname').single();
 if(d){await db.from('admin_actions').insert({restaurant_id:d.restaurant_id,admin_id:admin.userId,action:'domain:toggle',notes:d.hostname});revalidatePath(`/admin/restaurants/${d.restaurant_id}`);}
}
