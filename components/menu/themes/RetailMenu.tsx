"use client";
import { useState } from 'react';
import { useMenu } from '../MenuContext';
import { MenuImage } from '../MenuMedia';
import { categoryPath } from '@/lib/category-tree';
import { useI18n } from '@/components/i18n/I18nProvider';
import { priceRange } from '@/lib/utils';
export function RetailMenu(){
 const {data,currency,showPrices,openProduct}=useMenu();const {locale}=useI18n();const ar=locale==='ar';
 const [selected,setSelected]=useState<string|null>(null);const [query,setQuery]=useState('');
 const {restaurant,categories}=data;const active=categories.find(c=>c.id===selected);
 const children=categories.filter(c=>(c.parent_id??null)===selected);
 const searching=Boolean(query.trim());
 const products=searching?categories.flatMap(c=>c.products.map(p=>({...p,categoryLabel:categoryPath(categories,c.id)}))).filter(p=>`${p.name} ${p.description??''} ${p.categoryLabel}`.toLowerCase().includes(query.trim().toLowerCase())):(active?.products??[]);
 function go(id:string|null){setSelected(id);setQuery('');}
 return <div className="min-h-screen bg-ink-50 pb-24">
  <header className="bg-white px-5 py-8 text-center border-b border-ink-100">
   {restaurant.logo_url&&<MenuImage src={restaurant.logo_url} alt={restaurant.name} className="mx-auto size-20" sizes="80px"/>}
   <h1 className="mt-3 text-2xl font-bold">{restaurant.name}</h1>
   {restaurant.description&&<p className="mt-2 text-sm text-ink-500">{restaurant.description}</p>}
   {restaurant.address&&<p className="mt-2 text-sm text-ink-500">{restaurant.address}</p>}
   {restaurant.phone&&<a className="mt-2 inline-block text-brand-700" href={`tel:${restaurant.phone}`}>{restaurant.phone}</a>}
  </header>
  <main className="mx-auto max-w-5xl space-y-5 p-4">
   <input aria-label={ar?'ابحث عن صنف أو شركة':'Search products or brands'} placeholder={ar?'ابحث عن صنف أو شركة':'Search products or brands'} className="w-full rounded-xl border border-ink-200 bg-white p-3" value={query} onChange={e=>setQuery(e.target.value)}/>
   <nav aria-label={ar?'مسار الأقسام':'Category path'} className="flex flex-wrap gap-2 text-sm"><button onClick={()=>go(null)} className="text-brand-700">{ar?'كل الأقسام':'All categories'}</button>{active&&<><span>/</span><button onClick={()=>go(active.parent_id??null)}>{ar?'رجوع':'Back'}</button><span>{categoryPath(categories,active.id)}</span></>}</nav>
   {!searching&&children.length>0&&<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children.map(c=><button key={c.id} onClick={()=>go(c.id)} className="rounded-2xl border border-ink-200 bg-white p-4 text-start hover:border-brand-400">{c.image_url&&<MenuImage src={c.image_url} alt={c.name} className="mb-3 aspect-video w-full" sizes="240px"/>}<span className="font-semibold">{c.name}</span><span className="ms-2 text-brand-700">›</span></button>)}</div>}
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{products.map(p=><button key={p.id} onClick={()=>openProduct(p)} className="overflow-hidden rounded-2xl border border-ink-200 bg-white text-start"><MenuImage src={p.image_url} alt={p.name} className="aspect-square w-full" sizes="240px"/><div className="p-3"><p className="font-semibold">{p.name}</p>{'categoryLabel' in p&&<p className="mt-1 text-xs text-ink-500">{String(p.categoryLabel)}</p>}{showPrices&&<p className="mt-2 text-sm font-bold text-brand-700">{priceRange(p.product_variants.map(v=>Number(v.price)),currency)}</p>}</div></button>)}</div>
   {!products.length&&(searching||!children.length)&&<p className="py-12 text-center text-ink-500">{ar?'مفيش أصناف لعرضها حاليًا.':'No products to display yet.'}</p>}
  </main>
 </div>;
}
