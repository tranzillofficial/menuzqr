"use client";
import {useActionState,useState} from 'react';
import {BUSINESS_PRESETS,BUSINESS_MODULES,MODULE_LABELS,RETAIL_MODULES,moduleEnabled,type BusinessModule} from '@/lib/business-modules';
import {saveBusinessAccount,createBusinessAccount} from '@/lib/actions/business-accounts';
import {useI18n} from '@/components/i18n/I18nProvider';
import {SubmitButton} from '@/components/ui/SubmitButton';
import type {Restaurant} from '@/lib/types';
export function BusinessAccountForm({restaurant}:{restaurant?:Restaurant}){
 const {locale}=useI18n();const ar=locale==='ar';const label=(a:string,e:string)=>ar?a:e;
 const [state,action]=useActionState(restaurant?saveBusinessAccount:createBusinessAccount,null);
 const [selected,setSelected]=useState<BusinessModule[]>(restaurant?BUSINESS_MODULES.filter(m=>moduleEnabled(restaurant,m)):[...RETAIL_MODULES]);
 const [kind,setKind]=useState(restaurant?.business_kind??'retail');
 const input='w-full rounded-xl border border-ink-200 bg-white px-3 py-2';
 return <form action={action} className="space-y-4 rounded-2xl border border-ink-200 bg-white p-5">
 <h2 className="font-semibold">{restaurant?label('تخصيص أدوات الحساب','Account tools'):label('إنشاء حساب نشاط مخصص','Create a business account')}</h2>
 <p className="text-sm text-ink-500">{label('اختار قالب النشاط، وبعدها حدّد الموديولات المتاحة. الحساب الجديد بيبدأ فاضي، والتفعيل واشتراك الكاشير منفصلين.','Choose a business preset, then select its available modules. New accounts start empty. Activation and POS subscriptions are managed separately.')}</p>
 {restaurant?<input type="hidden" name="restaurant_id" value={restaurant.id}/>:<div className="grid gap-3 sm:grid-cols-2">{[['name',label('اسم النشاط','Business name'),'text'],['email',label('إيميل الدخول','Login email'),'email'],['password',label('باسورد 12 حرف على الأقل','Password (12 characters minimum)'),'password'],['slug',label('رابط النشاط بالإنجليزي','Business URL slug'),'text']].map(([name,text,type])=><label key={name} className="text-sm">{text}<input className={input} name={name} type={type} required minLength={name==='password'?12:2} autoComplete={name==='password'?'new-password':'off'}/></label>)}</div>}
 <label className="block text-sm">{label('وصف النشاط','Business type')}<input className={input} name="business_kind" value={kind} onChange={e=>setKind(e.target.value)} maxLength={80}/></label>
 <div className="flex flex-wrap gap-2">{Object.entries(BUSINESS_PRESETS).map(([value,preset])=><button key={value} type="button" className={`rounded-xl border px-3 py-2 text-sm ${kind===value?'border-brand-500 bg-brand-50':'border-ink-200'}`} onClick={()=>{setKind(value);setSelected([...preset.modules]);}}>{preset[ar?'ar':'en']}</button>)}</div>
 <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-3 text-sm font-medium">{label('الأدوات المتاحة','Available tools')}</legend>{BUSINESS_MODULES.map(m=><label key={m} className="flex items-center gap-2 text-sm"><input type="checkbox" name="modules" value={m} checked={selected.includes(m)} onChange={e=>setSelected(s=>e.target.checked?[...s,m]:s.filter(x=>x!==m))}/>{MODULE_LABELS[m][ar?'ar':'en']}</label>)}</fieldset>
 {state?.message&&<p role="status" className={state.ok?'text-sm text-emerald-700':'text-sm text-red-700'}>{state.message}</p>}
 <SubmitButton>{label(restaurant?'حفظ التخصيص':'إنشاء الحساب',restaurant?'Save configuration':'Create account')}</SubmitButton>
 </form>;
}
