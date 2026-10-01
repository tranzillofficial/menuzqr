"use server";
import { getMembership } from '@/lib/membership';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { TAX_MODES, MARKET, type TaxMode, type MarketRates } from '@/lib/tax';
import { getLocale } from '@/lib/i18n/server';
import { str, bool } from './helpers';
import type { ActionState } from '@/lib/types';
export async function saveTaxSettings(_previous: ActionState, form: FormData): Promise<ActionState> {
  const [member, locale] = await Promise.all([getMembership(),getLocale()]); const ar = locale === 'ar';
  if (!member?.isManager) return { ok:false,message:ar?'معندكش صلاحية تعديل الضريبة.':'Manager access required.' };
  const mode = str(form,'tax_mode') as TaxMode;
  if (!TAX_MODES.includes(mode)) return {ok:false,message:'Choose a tax mode.'};
  const registered=bool(form,'vat_registered'),number=str(form,'vat_number').replace(/\s/g,'').toUpperCase();
  const name=str(form,'legal_name').slice(0,160),address=str(form,'tax_address').slice(0,400);
  if (registered && (mode==='none'||!name||address.length<5||!number)) return {ok:false,message:ar?'كمّل اسم المنشأة القانوني وعنوانها ورقم الضريبة.':'Enter the legal business name, address and VAT number.'};
  if(registered && mode==='uk'&&!/^(GB)?\d{9}(\d{3})?$/.test(number)) return {ok:false,message:'Enter a UK VAT number with 9 or 12 digits, optionally prefixed GB.'};
  if(registered && (mode==='uae'||mode==='saudi')&&!/^\d{15}$/.test(number)) return {ok:false,message:ar?'الرقم الضريبي لازم يكون ١٥ رقم.':'The VAT number must have 15 digits.'};
  const rates: MarketRates = {};
  for (const market of TAX_MODES.filter(m => m !== 'none')) {
    const standard = Number(str(form, `${market}_standard`));
    const reduced = Number(str(form, `${market}_reduced`));
    if ([standard,reduced].some(n => !Number.isFinite(n) || n < 0 || n > 100 || Math.abs(n * 100 - Math.round(n * 100)) > 0.000001)) return {ok:false,message:ar?'النسبة لازم تكون من 0 لـ100 وبحد أقصى رقمين عشريين.':'Rates must be 0–100 with at most two decimal places.'};
    rates[market] = {standard,reduced};
  }
  const pricing = str(form,'pricing_mode');
  if (!['inclusive','exclusive_gross','exclusive_net'].includes(pricing)) return {ok:false,message:'Choose a pricing mode.'};
  const db=await createServerSupabase();
  const {error}=await db.from('restaurants').update({tax_mode:mode,vat_registered:registered,vat_number:number||null,legal_name:name||null,tax_address:address||null,tax_rates:rates,prices_include_vat:pricing==='inclusive',menu_prices_include_vat:pricing!=='exclusive_net',business_timezone:MARKET[mode].timezone,...(mode!=='none'?{currency:MARKET[mode].currency}:{})}).eq('id',member.restaurant.id);
  if(error) return {ok:false,message:ar?'تعذر حفظ الإعدادات. راجع البيانات وحاول تاني.':error.message};
  revalidatePath('/dashboard','layout'); revalidatePath(`/${member.restaurant.slug}/menu`);
  return {ok:true,message:ar?'إعدادات الضريبة اتحفظت.':'Tax settings saved.'};
}
export async function changeFinancialOrder(orderId:string,action:'refund'|'void'|'pay',reason:string,payment:'cash'|'card'='cash',received:number|null=null) {
  const member=await getMembership();
  if(!member?.isManager) return {ok:false,message:'Manager access required.'};
  if(!['refund','void','pay'].includes(action)||reason.length>400||(received!==null&&(!Number.isFinite(received)||received<0))) return {ok:false,message:'Invalid input.'};
  const {error}=await createAdminSupabase().rpc('change_fiscal_order',{p_actor:member.userId,p_restaurant:member.restaurant.id,p_order:orderId,p_action:action,p_reason:reason,p_payment:payment,p_received:received});
  if(error) return {ok:false,message:error.message};
  revalidatePath('/dashboard/orders');revalidatePath('/dashboard/reports');revalidatePath(`/dashboard/orders/${orderId}`);revalidatePath('/dashboard');
  return {ok:true,message:action==='refund'?'Refund recorded.':action==='void'?'Void recorded.':'Payment recorded.'};
}
export async function closeDay() {
  const member=await getMembership(); if(!member?.isManager)return {ok:false,message:'Manager access required.'};
  const {data,error}=await createAdminSupabase().rpc('close_fiscal_day',{p_actor:member.userId,p_restaurant:member.restaurant.id});
  if(error)return {ok:false,message:error.message};
  revalidatePath('/dashboard/reports'); return {ok:true,message:`Z report #${data.report_number} saved.`};
}

export async function recordReceiptPrint(orderId:string,document:'invoice'|'credit',method:'thermal'|'browser') {
 const member=await getMembership();if(!member?.isManager)return {ok:false};
 const {error}=await createAdminSupabase().rpc('record_fiscal_print',{p_actor:member.userId,p_restaurant:member.restaurant.id,p_order:orderId,p_document:document,p_method:method});
 return {ok:!error};
}
export async function issueFullVatInvoice(orderId:string,customer:{name:string;address:string;vat_number:string}) {
 const member=await getMembership();if(!member?.isManager)return {ok:false,message:'Manager access required.'};
 const {error}=await createAdminSupabase().rpc('issue_full_vat_document',{p_actor:member.userId,p_restaurant:member.restaurant.id,p_order:orderId,p_customer:customer});
 if(error)return {ok:false,message:error.message};revalidatePath(`/dashboard/orders/${orderId}`);return {ok:true,message:'VAT invoice saved.'};
}
