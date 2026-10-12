"use server";
import {featureEnabled} from "@/lib/business-features";
import {moduleEnabled} from '@/lib/business-modules';
import {normalizeBarcode, validBarcode} from '@/lib/barcode';
import {getMembership} from '@/lib/membership';
import {getPlatformSettings} from '@/lib/platform';
import {getLocale} from '@/lib/i18n/server';
import {hasPosAccess} from '@/lib/pos';
import {createServerSupabase} from '@/lib/supabase/server';
import type {ProductWithVariants} from '@/lib/types';

export async function lookupPosBarcode(raw: string) {
  const [member,platform,locale] = await Promise.all([getMembership(),getPlatformSettings(),getLocale()]);
  const l=(ar:string,en:string)=>locale==='ar'?ar:en;
  if (!member?.isManager || !featureEnabled(member.restaurant,'product_barcode') || !hasPosAccess(member.restaurant,platform.posEnabled)) return {ok:false as const,message:l('قراءة الباركود متاحة لكاشير السوبر ماركت المفعّل فقط.','Barcode lookup requires active supermarket POS access.')};
  const barcode=typeof raw==='string'?normalizeBarcode(raw):'';
  if(!validBarcode(barcode))return {ok:false as const,message:l('اكتب باركود صحيحًا.','Enter a valid barcode.')};
  const db=await createServerSupabase();
  // Query the account directly, independently of the POS category/filter or
  // the initial product list's API row limit. RLS remains enabled.
  const {data,error}=await db.from('products').select('*,product_variants(*)').eq('restaurant_id',member.restaurant.id).eq('barcode',barcode).eq('is_active',true).maybeSingle();
  if(error)return {ok:false as const,message:l('تعذر البحث عن الباركود. حاول مرة أخرى.','Could not look up barcode. Please retry.')};
  if(!data)return {ok:false as const,message:l('الباركود غير موجود أو المنتج غير مفعّل.','Barcode not found or product is inactive.')};
  return {ok:true as const,product:data as ProductWithVariants};
}

export async function lookupProductBarcode(raw: string) {
  const member = await getMembership();
  if (!member?.isManager || !featureEnabled(member.restaurant,'product_barcode')) return {ok:false as const,message:'غير مسموح بالبحث عن المنتجات. Product manager access required.'};
  const code = typeof raw === 'string' ? normalizeBarcode(raw) : '';
  if (!validBarcode(code)) return {ok:false as const,message:'الباركود غير صحيح. Invalid barcode.'};
  const db = await createServerSupabase();
  const {data,error} = await db.from('products').select('*,product_variants(*)').eq('restaurant_id',member.restaurant.id).eq('barcode',code).maybeSingle();
  if (error) return {ok:false as const,message:'تعذر البحث عن المنتج. Could not find product.'};
  if (!data) return {ok:false as const,message:'الباركود غير موجود في منتجات هذا الحساب. Barcode not found in this account.'};
  return {ok:true as const,product:data as ProductWithVariants};
}
