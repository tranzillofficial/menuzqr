'use client';
import {useEffect,useState} from 'react';
import {lookupSupermarketDraft} from '@/lib/actions/supermarket-catalog';
import {type SupermarketItem} from '@/lib/supermarket-catalog';
import {SmartImage} from '@/components/ui/SmartImage';
import {useI18n} from '@/components/i18n/I18nProvider';

export function SupermarketSuggestionRows({items,onPick}:{items:SupermarketItem[];onPick:(item:SupermarketItem)=>void}){
 const {locale}=useI18n();
 return <ul className="max-h-72 divide-y divide-ink-100 overflow-y-auto">{items.map(item=><li key={item.id}><button type="button" onClick={()=>onPick(item)} className="flex w-full items-center gap-2 px-3 py-2 text-start hover:bg-brand-50"><span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-ink-50"><SmartImage src={item.supermarket_catalog_images?.[0]?.url} alt="" sizes="64px"/></span><span className="min-w-0 flex-1"><span className="block text-xs font-medium leading-5">{item.name_ar}</span><span className="block text-[11px] text-ink-500">{item.brand}</span></span><span className="text-[11px] text-brand-700">{locale==='ar'?'استخدم البيانات':'Use details'}</span></button></li>)}</ul>;
}

export function SupermarketDraftSuggestions({query,onPick}:{query:string;onPick:(item:SupermarketItem)=>void}){
 const {locale}=useI18n();const ar=locale==='ar';
 const [items,setItems]=useState<SupermarketItem[]>([]);const [loading,setLoading]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{let active=true;setItems([]);setError('');setLoading(true);const timer=setTimeout(()=>{lookupSupermarketDraft(query,'name').then(result=>{if(active){setItems(result.items);setError(result.error??'');setLoading(false);}}).catch(()=>{if(active){setError(ar?'تعذر البحث، حاول مرة أخرى.':'Could not search. Try again.');setLoading(false);}});},300);return()=>{active=false;clearTimeout(timer);};},[query,ar]);
 return <div className="overflow-hidden rounded-xl border border-brand-100 bg-white"><p role="status" className="bg-brand-50/60 px-3 py-2 text-xs text-brand-800">{loading?(ar?'نبحث عن منتجات مشابهة…':'Finding similar products…'):error||(items.length?(ar?'منتجات مشابهة — اختار العبوة المطابقة':'Similar products — choose the matching pack'):(ar?'لا توجد اقتراحات؛ تقدر تكمل الإضافة يدويًا.':'No suggestions. Continue adding manually.'))}</p><SupermarketSuggestionRows items={items} onPick={onPick}/></div>;
}
