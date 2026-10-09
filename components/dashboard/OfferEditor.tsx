"use client";
import {useActionState,useState} from 'react';
import {saveOffer} from '@/lib/actions/offers';
import {ImagePicker} from '@/components/ui/ImagePicker';
import {useI18n} from '@/components/i18n/I18nProvider';
import type {BusinessOffer} from '@/lib/types';
export function OfferEditor({restaurantId,products,offer,startDate='',endDate=''}:{restaurantId:string;products:{id:string;name:string}[];offer?:BusinessOffer;startDate?:string;endDate?:string}){
 const [state,action,pending]=useActionState(saveOffer,null);const [image,setImage]=useState(offer?.image_url??null);const {locale}=useI18n();const ar=locale==='ar';
 return <form action={action} className="space-y-4 rounded-2xl border bg-white p-5"><h2 className="font-bold">{offer?offer.title:(ar?'إضافة عرض':'Add an offer')}</h2><input type="hidden" name="id" value={offer?.id??''}/><input type="hidden" name="image_url" value={image??''}/>
 <label className="block text-sm">{ar?'عنوان العرض':'Offer title'}<input name="title" required minLength={2} maxLength={100} defaultValue={offer?.title} className="mt-1 w-full rounded-xl border p-3"/></label>
 <label className="block text-sm">{ar?'تفاصيل العرض':'Offer details'}<textarea name="description" maxLength={1200} defaultValue={offer?.description} rows={3} className="mt-1 w-full rounded-xl border p-3"/></label>
 <ImagePicker restaurantId={restaurantId} kind="cover" aspect="wide" value={image} onChange={setImage} allowLibrary={false}/>
 <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">{ar?'يبدأ يوم (اختياري)':'Start day (optional)'}<input name="starts_on" type="date" defaultValue={startDate} className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm">{ar?'آخر يوم للعرض (اختياري)':'Last offer day (optional)'}<input name="ends_on" type="date" defaultValue={endDate} className="mt-1 w-full rounded-xl border p-3"/></label></div>
 <fieldset><legend className="mb-2 text-sm font-semibold">{ar?'منتجات العرض':'Offer products'}</legend><div className="max-h-56 space-y-2 overflow-y-auto rounded-xl bg-ink-50 p-3">{products.map(p=><label key={p.id} className="flex gap-2 text-sm"><input type="checkbox" name="product_ids" value={p.id} defaultChecked={offer?.product_ids.includes(p.id)}/>{p.name}</label>)}{!products.length&&<p className="text-sm text-ink-500">{ar?'أضف المنتجات أولًا لتتمكن من ربطها بالعرض.':'Add products first to link them to your offer.'}</p>}</div></fieldset>
 <p className="text-xs text-ink-500">{ar?'أسعار الشراء هي أسعار المنتج المسجلة. عدّل سعر المنتج من صفحة المنتجات إذا كان العرض يتضمن سعرًا خاصًا. التواريخ حسب توقيت نشاطك.':'Checkout uses saved product prices. Set special prices on the Products page. Dates use your business timezone.'}</p>
 <label className="flex gap-2 text-sm"><input name="is_active" type="checkbox" defaultChecked={offer?.is_active??false}/>{ar?'تفعيل العرض على المنيو':'Publish offer on the menu'}</label>
 {state?.message&&<p role="status" className={state.ok?'text-sm text-emerald-700':'text-sm text-red-700'}>{state.message}</p>}<button disabled={pending} className="rounded-xl bg-ink-900 px-5 py-3 text-sm text-white disabled:opacity-50">{pending?(ar?'جاري الحفظ…':'Saving…'):(ar?'حفظ العرض':'Save offer')}</button></form>;
}
