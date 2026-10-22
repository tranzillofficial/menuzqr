"use client";
import type {BusinessType} from "@/lib/business-configuration";
import {useActionState,useState} from 'react';
import {BUSINESS_PRESETS,BUSINESS_MODULES,MODULE_LABELS,RETAIL_MODULES,MENU_ONLY_MODULES,isMenuOnly,moduleEnabled,type BusinessModule} from '@/lib/business-modules';
import {BUSINESS_FEATURES, MENU_ONLY_FEATURES, FEATURE_REGISTRY, featureEnabled, presetFeatures, type BusinessFeature} from '@/lib/business-features';
import {saveBusinessAccount,createBusinessAccount} from '@/lib/actions/business-accounts';
import {useI18n} from '@/components/i18n/I18nProvider';
import {SubmitButton} from '@/components/ui/SubmitButton';
import type {Restaurant} from '@/lib/types';
export function BusinessAccountForm({restaurant,types=[]}:{restaurant?:Restaurant;types?:BusinessType[]}){
 const {locale}=useI18n();const ar=locale==='ar';const label=(a:string,e:string)=>ar?a:e;
 const [state,action]=useActionState(restaurant?saveBusinessAccount:createBusinessAccount,null);
 const [selected,setSelected]=useState<BusinessModule[]>(restaurant?BUSINESS_MODULES.filter(m=>moduleEnabled(restaurant,m)):[...MENU_ONLY_MODULES]);
 const [features,setFeatures]=useState<BusinessFeature[]>(restaurant?BUSINESS_FEATURES.filter(f=>featureEnabled(restaurant,f)):[...MENU_ONLY_FEATURES]);
 const [accountPackage,setAccountPackage]=useState(restaurant?(isMenuOnly(restaurant)?'menu_only':'custom'):'menu_only');
 const [typeId,setTypeId]=useState("");
 const [kind,setKind]=useState(restaurant?.business_kind??'restaurant');
 const input='w-full rounded-xl border border-ink-200 bg-white px-3 py-2';
 return <form action={action} className="space-y-4 rounded-2xl border border-ink-200 bg-white p-5">
 <h2 className="font-semibold">{restaurant?label('تخصيص أدوات الحساب','Account tools'):label('إنشاء حساب نشاط مخصص','Create a business account')}</h2>
 <p className="text-sm text-ink-500">{label('اختار قالب النشاط، وبعدها حدّد الموديولات المتاحة. الحساب الجديد بيبدأ فاضي، والتفعيل واشتراك الكاشير منفصلين.','Choose a business preset, then select its available modules. New accounts start empty. Activation and POS subscriptions are managed separately.')}</p>
 {restaurant?<input type="hidden" name="restaurant_id" value={restaurant.id}/>:<div className="grid gap-3 sm:grid-cols-2">{[['name',label('اسم النشاط','Business name'),'text'],['email',label('إيميل الدخول','Login email'),'email'],['password',label('باسورد 8 حروف على الأقل','Password (8 characters minimum)'),'password'],['slug',label('رابط النشاط بالإنجليزي','Business URL slug'),'text']].map(([name,text,type])=><label key={name} className="text-sm">{text}<input className={input} name={name} type={type} required minLength={name==='password'?8:2} autoComplete={name==='password'?'new-password':'off'}/></label>)}</div>}
 <label className="block text-sm">{label('الباقة','Package')}<select name="account_package" className={input} value={accountPackage} onChange={e=>{setAccountPackage(e.target.value);setTypeId('');if(e.target.value==='menu_only'){setSelected([...MENU_ONLY_MODULES]);setFeatures([...MENU_ONLY_FEATURES]);}else{setSelected([...RETAIL_MODULES]);setFeatures(presetFeatures(kind));}}}><option value="menu_only">{label('منيو فقط · 800 جنيه مرة واحدة','Menu only · EGP 800 one time')}</option><option value="custom">{label('باقة مخصصة / خدمات إضافية','Custom package / additional services')}</option></select></label>
 {accountPackage==='menu_only'&&<input type="hidden" name="business_kind" value={kind}/>}
 {accountPackage==='menu_only'&&<p className="text-sm text-ink-500">{label('إدارة الأقسام والأصناف وتصميم المنيو وأكواد QR والإعدادات.','Categories, products, menu design, QR codes and settings.')}</p>}
 {accountPackage==='custom'&&<>
 {!restaurant&&types.length>0&&<label className="block text-sm">{label('قالب النشاط والوراثة','Business template and inheritance')}<select name="business_type_id" className={input} value={typeId} onChange={e=>{const id=e.target.value;setTypeId(id);const type=types.find(t=>t.id===id);if(type){setKind(type.business_kind);setSelected(BUSINESS_MODULES.filter(m=>type.default_modules.includes(m)));setFeatures(BUSINESS_FEATURES.filter(f=>type.default_capabilities.includes(f)));}}}><option value="">{label('إعدادات مستقلة','Independent settings')}</option>{types.filter(t=>t.is_active).map(t=><option key={t.id} value={t.id}>{t[ar?'name_ar':'name_en']} · {t.country_code} / {t.currency}</option>)}</select></label>}
 <label className="block text-sm">{label('وصف النشاط','Business type')}<input className={input} name="business_kind" value={kind} onChange={e=>setKind(e.target.value)} maxLength={80}/></label>
 <div className="flex flex-wrap gap-2">{Object.entries(BUSINESS_PRESETS).map(([value,preset])=><button key={value} type="button" className={`rounded-xl border px-3 py-2 text-sm ${kind===value?'border-brand-500 bg-brand-50':'border-ink-200'}`} onClick={()=>{setTypeId("");setKind(value);setSelected([...preset.modules]);setFeatures(presetFeatures(value));}}>{preset[ar?'ar':'en']}</button>)}</div>
 <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-3 text-sm font-medium">{label('الأدوات المتاحة','Available tools')}</legend>{BUSINESS_MODULES.map(m=><label key={m} className="flex items-center gap-2 text-sm"><input type="checkbox" name="modules" value={m} checked={selected.includes(m)} onChange={e=>setSelected(s=>e.target.checked?[...s,m]:s.filter(x=>x!==m))}/>{MODULE_LABELS[m][ar?'ar':'en']}</label>)}</fieldset>
 <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-3 text-sm font-medium">{label('خصائص الأقسام الداخلية','Features inside each section')}</legend>{BUSINESS_FEATURES.map(f=><label key={f} className="flex items-center gap-2 text-sm"><input type="checkbox" name="features" value={f} disabled={!selected.includes(FEATURE_REGISTRY[f].module)} checked={features.includes(f)} onChange={e=>setFeatures(s=>e.target.checked?[...s,f]:s.filter(x=>x!==f))}/><span>{FEATURE_REGISTRY[f][ar?'ar':'en']} <small className="text-ink-400">· {MODULE_LABELS[FEATURE_REGISTRY[f].module][ar?'ar':'en']}</small></span></label>)}</fieldset>
 </>}
 {state?.message&&<p role="status" className={state.ok?'text-sm text-emerald-700':'text-sm text-red-700'}>{state.message}</p>}
 <SubmitButton>{label(restaurant?'حفظ التخصيص':'إنشاء الحساب',restaurant?'Save configuration':'Create account')}</SubmitButton>
 </form>;
}
