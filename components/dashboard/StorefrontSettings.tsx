"use client";
import {useActionState} from 'react';
import {saveStorefrontDetails} from '@/lib/actions/storefront';
import {featureEnabled} from '@/lib/business-features';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {useI18n} from '@/components/i18n/I18nProvider';
import type {Restaurant, StorefrontDetails} from '@/lib/types';
export function StorefrontSettings({restaurant,details}:{restaurant:Restaurant;details:StorefrontDetails}){
 const [state,action]=useActionState(saveStorefrontDetails,null);const {locale}=useI18n();const l=(a:string,e:string)=>locale==='ar'?a:e;
 const field='mt-1 w-full rounded-xl border border-ink-100 bg-ink-50/50 p-3 text-base';
 return <form action={action} className="space-y-5 rounded-2xl bg-white p-4 sm:p-6">
 {featureEnabled(restaurant,'delivery_settings')&&<fieldset className="space-y-3"><legend className="font-semibold">{l('التوصيل','Delivery')}</legend><label className="block text-sm">{l('رسوم التوصيل الثابتة','Flat delivery fee')}<input name="delivery_fee" type="number" min="0" max="100000" step="0.01" defaultValue={details.delivery_fee} className={field}/></label><label className="block text-sm">{l('توصيل مجاني عند وصول المنتجات إلى (اتركه فارغًا لإلغائه)','Free delivery above subtotal (leave blank to disable)')}<input name="free_delivery_above" type="number" min="0" max="1000000" step="0.01" defaultValue={details.free_delivery_above??''} className={field}/></label><p className="text-xs text-ink-500">{l('تطبق الرسوم على طلبات توصيل السوبر ماركت فقط وتظهر قبل تأكيد الطلب.','Fees apply to supermarket delivery orders and appear before checkout.')}</p></fieldset>}
 {featureEnabled(restaurant,'payment_settings')&&<label className="block space-y-2 text-sm font-medium">{l('بيانات دفع إضافية (حساب بنكي، رقم أو تعليمات)','Additional payment details (bank account, number or instructions)')}<textarea name="payment_details" maxLength={1200} rows={3} defaultValue={details.payment_details} className={field}/></label>}
 {featureEnabled(restaurant,'contact_settings')&&<fieldset className="space-y-3"><legend className="font-semibold">{l('التواصل والموقع','Contact and location')}</legend>{(['whatsapp_url','facebook_url','instagram_url','tiktok_url','website_url','location_url'] as const).map(key=><label key={key} className="block text-sm">{({whatsapp_url:l('رابط واتساب','WhatsApp URL'),tiktok_url:'TikTok',location_url:l('رابط اللوكيشن','Location URL'),facebook_url:'Facebook',instagram_url:'Instagram',website_url:l('الموقع الإلكتروني','Website')})[key]}<input type="url" name={key} dir="ltr" maxLength={500} defaultValue={details[key]} placeholder="https://" className={field}/></label>)}</fieldset>}
 {state?.message&&<p role="status" className={state.ok?'text-emerald-700':'text-red-700'}>{state.message}</p>}<SubmitButton>{l('حفظ','Save')}</SubmitButton></form>;
}
