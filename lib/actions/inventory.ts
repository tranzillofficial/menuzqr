"use server";
import {revalidatePath} from 'next/cache';
import {getMenuRestaurant,str,fail,done,bool} from './helpers';
import {createServerSupabase} from '@/lib/supabase/server';
import type {ActionState} from '@/lib/types';
export async function saveStock(_prev:ActionState,form:FormData):Promise<ActionState>{
 const owned=await getMenuRestaurant('inventory');if(!owned.ok)return owned.error;
 const qty=Number(str(form,'quantity'));if(!Number.isFinite(qty)||Math.abs(qty)>1000000)return fail('راجع كمية المخزون. Invalid stock quantity.');
 const db=await createServerSupabase();const {data,error}=await db.from('product_variants').update({stock_quantity:Math.round(qty*1000)/1000,stock_tracked:bool(form,'tracked')}).eq('restaurant_id',owned.restaurant.id).eq('id',str(form,'variant_id')).select('id').maybeSingle();
 if(error||!data)return fail('تعذر حفظ المخزون. Could not save stock.');revalidatePath('/dashboard/inventory');return done('تم حفظ الرصيد. Stock saved.');
}
