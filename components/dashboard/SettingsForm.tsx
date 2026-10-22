"use client";
import {useActionState,useState,useEffect,useRef,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {saveDashboardSettings} from '@/lib/actions/dashboard-settings';
import {featureEnabled} from '@/lib/business-features';
import {isMenuOnly,moduleEnabled} from '@/lib/business-modules';
import {useI18n} from '@/components/i18n/I18nProvider';
import {Switch} from '@/components/ui/Field';
import {Icon} from '@/components/ui/Icons';
import {normalizeWhatsapp,phoneWithCountry} from '@/lib/phone';
import {cn} from '@/lib/utils';
import type {Restaurant,PaymentInstructions} from '@/lib/types';
type Settings=Partial<PaymentInstructions>&{sound_enabled:boolean;show_prices:boolean;show_ingredients:boolean};
export function SettingsForm({restaurant:r,settings:s,hasTables,sections=[]}:{restaurant:Restaurant;settings:Settings;hasTables:boolean;sections?:{id:string;ar:string;en:string;content:ReactNode}[]}){
 const {locale}=useI18n(),l=(a:string,e:string)=>locale==='ar'?a:e,router=useRouter();const [active,setActive]=useState('features'),[state,action,pending]=useActionState(saveDashboardSettings,null),form=useRef<HTMLFormElement>(null);
 const initial={sound_enabled:s.sound_enabled,show_prices:s.show_prices,show_ingredients:s.show_ingredients,ordering_enabled:r.ordering_enabled,waiter_calls_enabled:r.waiter_calls_enabled,remote_ordering_enabled:s.remote_ordering_enabled??false};
 const [values,setValues]=useState(initial);
 const phone=normalizeWhatsapp(s.payment_whatsapp??''),prefix=phone.startsWith('20')?'20':phone.startsWith('44')?'44':phone.startsWith('971')?'971':phone.startsWith('966')?'966':'20';
 const [country,setCountry]=useState(prefix),[number,setNumber]=useState(phone.startsWith(prefix)?phone.slice(prefix.length):phone);
 const tables=hasTables&&moduleEnabled(r,'tables'),retail=r.business_kind==='supermarket',payments=featureEnabled(r,'payment_settings'),delivery=retail&&featureEnabled(r,'delivery_settings');
 const mainActive=active==='features'||active==='storefront';
 const tabs=[{id:'features',ar:isMenuOnly(r)?'عرض المنيو':'العرض والطلبات',en:isMenuOnly(r)?'Menu display':'Display & orders',icon:Icon.eye},...(delivery||payments?[{id:'storefront',ar:'التوصيل والدفع',en:'Delivery & payment',icon:Icon.store}]:[]),...sections.map(s=>({...s,icon:s.id==='profile'?Icon.users:s.id==='whatsapp'?Icon.qr:s.id==='alerts'?Icon.bell:s.id==='print'?Icon.print:s.id==='account'?Icon.users:Icon.receipt}))];
 useEffect(()=>{if(state?.ok)router.refresh();},[state,router]);
 const field='mt-2 min-w-0 w-full rounded-xl border border-ink-100 bg-white px-3 py-2.5 text-xs outline-none focus:border-brand-300 sm:text-sm';
 function row(key:keyof typeof values,title:string,description:string,IconComponent:typeof Icon.eye){return <div key={key} className="flex items-center gap-3 border-b border-ink-100 p-3 last:border-0 sm:p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><IconComponent className="size-4"/></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold sm:text-sm">{title}</p><p className="mt-1 text-[11px] leading-5 text-ink-400 sm:text-xs">{description}</p></div><Switch checked={values[key]} label={title} onChange={v=>setValues(prev=>({...prev,[key]:v}))}/></div>}
 function title(name:string,description:string,IconComponent=Icon.grid){return <div className="mb-4 flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><IconComponent className="size-4"/></span><div><h2 className="text-sm font-semibold sm:text-base">{name}</h2><p className="mt-1 text-[11px] leading-5 text-ink-400 sm:text-xs">{description}</p></div></div>}
 return <div className="space-y-4">
  <div role="tablist" aria-label={l('أقسام الإعدادات','Settings sections')} className="flex gap-1.5 overflow-x-auto rounded-2xl bg-white p-2 ring-1 ring-black/5">{tabs.map(t=><button key={t.id} type="button" role="tab" id={`settings-tab-${t.id}`} aria-selected={active===t.id} aria-controls={`settings-panel-${t.id}`} onClick={()=>setActive(t.id)} className={cn('flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-medium',active===t.id?'bg-brand-600 text-white':'text-ink-600 hover:bg-ink-50')}><t.icon className="size-4"/>{l(t.ar,t.en)}</button>)}</div>
  <form ref={form} action={action} noValidate hidden={!mainActive} className="space-y-4 pb-20 sm:pb-0">
   <fieldset disabled={pending} className="space-y-4">
    {Object.entries(values).map(([key,value])=><input key={key} type="hidden" name={key} value={(key==='ordering_enabled'&&!tables&&!retail?values.remote_ordering_enabled:value)?'on':''}/>)}
    <section hidden={active!=='features'} id="settings-panel-features" role="tabpanel" aria-labelledby="settings-tab-features" className="rounded-2xl bg-white p-3 ring-1 ring-black/5 sm:p-5">{title(l('مزايا المنيو','Menu features'),l('تحكم في عرض المنيو وخيارات الطلب المتاحة لعملائك.','Control menu display and ordering options.'))}<div className="overflow-hidden rounded-xl border border-ink-100">
     {moduleEnabled(r,'orders')&&row('sound_enabled',l('صوت الإشعارات','Notification sound'),l('تشغيل نغمة عند وصول طلب جديد.','Play a sound when a new order arrives.'),Icon.bell)}
     {row('show_prices',l('إظهار الأسعار','Show prices'),l('إظهار أو إخفاء أسعار الأصناف في المنيو.','Show or hide item prices in the menu.'),Icon.eye)}
     {featureEnabled(r,'online_ordering')&&row(retail?'ordering_enabled':'remote_ordering_enabled',retail?l('طلبات التوصيل — الدفع عند الاستلام','Delivery orders — pay on delivery'):l('الطلب من المنيو','Online menu ordering'),l('استقبال طلبات من الرابط العام بدون طاولة.','Receive orders from the public menu link.'),Icon.store)}
     {tables&&moduleEnabled(r,'orders')&&featureEnabled(r,'online_ordering')&&row('ordering_enabled',l('طلبات الطاولات','Table orders'),l('استقبال طلبات من QR الطاولة.','Receive orders through table QR codes.'),Icon.table)}
     {tables&&moduleEnabled(r,'service_calls')&&row('waiter_calls_enabled',l('نداء النادل','Call waiter'),l('السماح بطلب الخدمة من الطاولة.','Allow customers to request table service.'),Icon.bell)}
     {featureEnabled(r,'product_ingredients')&&row('show_ingredients',l('إظهار المكونات','Show ingredients'),l('عرض المكونات المسجلة للأصناف.','Display item ingredients.'),Icon.burger)}
    </div></section>
    {payments&&<section className="rounded-2xl bg-white p-3 ring-1 ring-black/5 sm:p-5">{title(l('معلومات التواصل والدفع','Contact & payment information'),l('تظهر في المنيو وتُستخدم لاستقبال الطلبات والتواصل بشأن الدفع.','Shown in your menu for ordering and payment enquiries.'),Icon.receipt)}<div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center">
     <label htmlFor="cash-wallet" className="text-xs sm:text-sm">{l('رقم محفظة كاش','Cash wallet number')}</label><input id="cash-wallet" name="cash_wallet" defaultValue={s.cash_wallet??''} maxLength={30} dir="ltr" className={field}/>
     <label htmlFor="instapay-address" className="text-xs sm:text-sm">{l('عنوان أو رقم InstaPay','InstaPay address or number')}</label><input id="instapay-address" name="instapay_address" defaultValue={s.instapay_address??''} maxLength={120} dir="ltr" className={field}/>
     <label htmlFor="settings-whatsapp" className="text-xs sm:text-sm">{l('رقم واتساب بكود الدولة','WhatsApp with country code')}</label><div className="mt-2 flex min-w-0 overflow-hidden rounded-xl border border-ink-100" dir="ltr"><select aria-label={l('كود الدولة','Country code')} value={country} onChange={e=>setCountry(e.target.value)} className="w-24 shrink-0 bg-ink-50 px-2 text-xs"><option value="20">🇪🇬 +20</option><option value="44">🇬🇧 +44</option><option value="971">🇦🇪 +971</option><option value="966">🇸🇦 +966</option></select><input id="settings-whatsapp" type="tel" value={number} onChange={e=>setNumber(e.target.value)} placeholder="1012345678" maxLength={20} className="min-w-0 flex-1 px-3 py-2.5 text-xs outline-none sm:text-sm"/><input type="hidden" name="payment_whatsapp" value={phoneWithCountry(number,country)}/></div>
     <label htmlFor="payment-details" className="text-xs sm:text-sm">{l('بيانات وأرقام دفع أخرى','Other payment details')}</label><textarea id="payment-details" name="payment_details" rows={2} defaultValue={s.payment_details??''} maxLength={1200} className={field}/>
    </div><p className="mt-4 rounded-xl bg-brand-50 p-3 text-[11px] leading-5 text-brand-800">{l('التحويلات تُراجع يدويًا قبل تأكيد الدفع. الرقم المصري يُصحح تلقائيًا بدون تكرار كود الدولة.','Verify transfers manually before confirming payment. Egyptian numbers are normalized without repeating the country code.')}</p></section>}
    <section hidden={active!=='storefront'} id="settings-panel-storefront" role="tabpanel" aria-labelledby="settings-tab-storefront" className="space-y-4">
     {delivery&&<div className="rounded-2xl bg-white p-3 ring-1 ring-black/5 sm:p-5">{title(l('رسوم التوصيل','Delivery fees'),l('تطبق على طلبات توصيل السوبرماركت وتظهر قبل التأكيد.','Applied to supermarket delivery orders before confirmation.'),Icon.store)}<div className="grid gap-3 sm:grid-cols-2"><label className="text-xs">{l('رسوم التوصيل الثابتة','Flat delivery fee')}<input name="delivery_fee" type="number" min={0} step="0.01" defaultValue={s.delivery_fee??0} className={field}/></label><label className="text-xs">{l('توصيل مجاني للطلبات فوق','Free delivery above')}<input name="free_delivery_above" type="number" min={0} step="0.01" defaultValue={s.free_delivery_above??''} placeholder={l('اتركه فارغًا للإلغاء','Leave blank to disable')} className={field}/></label></div></div>}
    </section>
   </fieldset>
   {state?.message&&<p role="status" className={cn('rounded-xl p-3 text-xs',state.ok?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-700')}>{state.message}</p>}
   <footer className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-ink-100 bg-white p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:static sm:rounded-2xl sm:border-0 sm:p-4 sm:ring-1 sm:ring-black/5"><button disabled={pending} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-xs font-semibold text-white disabled:opacity-50 sm:flex-none"><Icon.check className="size-4"/>{pending?l('جاري الحفظ…','Saving…'):l('حفظ التعديلات','Save changes')}</button><button type="button" disabled={pending} onClick={()=>{form.current?.reset();setValues(initial);setCountry(prefix);setNumber(phone.startsWith(prefix)?phone.slice(prefix.length):phone);}} className="rounded-xl border border-ink-100 px-5 py-3 text-xs">{l('إلغاء','Cancel')}</button></footer>
  </form>
  {sections.map(s=><section key={s.id} hidden={active!==s.id} role="tabpanel" id={`settings-panel-${s.id}`} aria-labelledby={`settings-tab-${s.id}`}>{s.content}</section>)}
 </div>;
}
