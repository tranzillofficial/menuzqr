"use client";
import {useActionState,useState} from 'react';
import {saveMenuContact} from '@/lib/actions/menu-contact';
import {useI18n} from '@/components/i18n/I18nProvider';
import {ImagePicker} from '@/components/ui/ImagePicker';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {contactPhones} from '@/lib/menu-contact';
import type {Restaurant,PaymentInstructions} from '@/lib/types';
export function MenuContactForm({restaurant,settings}:{restaurant:Restaurant;settings:Partial<PaymentInstructions>|null}){
 const {locale}=useI18n();const l=(ar:string,en:string)=>locale==='ar'?ar:en;
 const [state,action]=useActionState(saveMenuContact,null);const [logo,setLogo]=useState(restaurant.logo_url);
 const field='mt-1 min-h-11 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-base';
 return <form action={action} className="mt-5 space-y-4 rounded-2xl bg-white p-4 ring-1 ring-black/5">
 <div><h2 className="text-sm font-semibold">{l('اللوجو والتواصل في المنيو','Menu branding and contact')}</h2><p className="mt-1 text-xs text-ink-500">{l('تظهر آيكونات البيانات المضافة فقط. أرقام الاتصال منفصلة عن الواتساب.','Only saved contact details appear. Phone numbers are separate from WhatsApp.')}</p></div>
 <div className="grid gap-4 sm:grid-cols-2"><div><p className="mb-2 text-xs">{l('لوجو الكافيه','Business logo')}</p><ImagePicker restaurantId={restaurant.id} kind="logo" value={logo} onChange={setLogo} allowLibrary={false}/><input type="hidden" name="logo_url" value={logo??''}/></div>
 <div className="space-y-3"><label className="block text-xs">{l('العنوان','Address')}<textarea name="address" rows={2} maxLength={400} defaultValue={restaurant.address??''} className={field}/></label><label className="block text-xs">{l('أرقام الاتصال، كل رقم في سطر','Phone numbers, one per line')}<textarea name="contact_phones" rows={3} dir="ltr" maxLength={250} defaultValue={contactPhones(restaurant.contact_phones??[],restaurant.phone).join('\n')} className={field}/></label></div></div>
 <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs">WhatsApp<input name="payment_whatsapp" type="tel" dir="ltr" maxLength={30} defaultValue={settings?.payment_whatsapp??''} placeholder="+20…" className={field}/></label>{(['location_url','instagram_url','facebook_url','website_url'] as const).map(key=><label key={key} className="text-xs">{{location_url:l('رابط اللوكيشن','Location URL'),instagram_url:'Instagram',facebook_url:'Facebook',website_url:l('الموقع الإلكتروني','Website')}[key]}<input name={key} type="url" dir="ltr" maxLength={500} defaultValue={settings?.[key]??''} placeholder="https://" className={field}/></label>)}</div>
 {state?.message&&<p role="status" className={`text-xs ${state.ok?'text-emerald-700':'text-red-700'}`}>{state.message}</p>}<SubmitButton>{l('حفظ بيانات المنيو','Save menu details')}</SubmitButton></form>;
}
