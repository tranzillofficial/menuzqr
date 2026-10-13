"use server";
import {featureEnabled} from '@/lib/business-features';
import {requireManager} from '@/lib/membership';
import {moduleEnabled} from '@/lib/business-modules';
import {createServerSupabase} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
import type {ActionState} from '@/lib/types';
export async function saveCustomerDetails(_prev:ActionState,form:FormData):Promise<ActionState>{
 const m=await requireManager('/dashboard/customers');if(!moduleEnabled(m.restaurant,'customers'))return {ok:false,message:'العملاء غير متاحين لهذا الحساب. Customers unavailable.'};
 const id=String(form.get('id')??''),code=String(form.get('code')??'').trim(),name=String(form.get('name')??'').trim(),address=String(form.get('address')??'').trim(),phone=String(form.get('phone')??'').replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660)).replace(/[\s()+.-]/g,'');
 if(name.length<2||name.length>160||code.length>40||address.length>400||!/^\d{8,15}$/.test(phone)||id&&!/^[0-9a-f-]{36}$/i.test(id))return {ok:false,message:'راجع اسم العميل ورقم الموبايل والبيانات. Check customer details.'};
 if(!featureEnabled(m.restaurant,id?"customer_edit":"customer_create"))return {ok:false,message:"تعديل العملاء معطل لهذا الحساب. Customer editing disabled."};
 const db=await createServerSupabase(),payload={code:code||null,name,address,phone};
 const request=id?db.from('business_customers').update(payload).eq('id',id).eq('restaurant_id',m.restaurant.id):db.from('business_customers').insert({...payload,restaurant_id:m.restaurant.id});
 const {data,error}=await request.select('id').maybeSingle();if(error||!data)return {ok:false,message:error?.code==='23505'?'رقم الموبايل أو الكود مستخدم بالفعل. Phone or code already used.':'تعذر حفظ العميل. Could not save customer.'};
 revalidatePath('/dashboard/customers');return {ok:true,message:'تم حفظ بيانات العميل. Customer saved.'};
}
export async function saveCustomer(form:FormData){const result=await saveCustomerDetails(null,form);if(!result?.ok)throw Error(result?.message);}
