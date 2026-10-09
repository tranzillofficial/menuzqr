"use server";
import {requireManager} from '@/lib/membership';
import {moduleEnabled} from '@/lib/business-modules';
import {createServerSupabase} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
export async function saveCustomer(form:FormData){
 const m=await requireManager('/dashboard/customers');if(!moduleEnabled(m.restaurant,'customers'))throw new Error('Customers unavailable');
 const id=String(form.get('id')??''),code=String(form.get('code')??'').trim(),name=String(form.get('name')??'').trim(),address=String(form.get('address')??'').trim();
 if(name.length<2||name.length>160||code.length>40||address.length>400)throw new Error('Invalid customer details');
 const db=await createServerSupabase();const {error}=await db.from('business_customers').update({code:code||null,name,address}).eq('id',id).eq('restaurant_id',m.restaurant.id);
 if(error)throw new Error(error.code==='23505'?'كود العميل مستخدم بالفعل. اختر كودًا آخر.':'تعذر حفظ العميل');revalidatePath('/dashboard/customers');
}
