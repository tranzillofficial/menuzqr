"use client";
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {useI18n} from '@/components/i18n/I18nProvider';
import {formatMoney} from '@/lib/utils';
import type {OrderWithDetails} from '@/lib/types';
export function IncomingOrders({orders}:{orders:OrderWithDetails[];retail?:boolean}) {
 const router=useRouter();const {locale}=useI18n();const ar=locale==='ar';
 useEffect(()=>{const id=window.setInterval(()=>{if(document.visibilityState==='visible')router.refresh();},20000);return ()=>clearInterval(id);},[router]);
 return <section className="mb-4 rounded-xl border border-brand-200 bg-white p-3">
  <h2 className="text-sm font-semibold">{ar?'الطلبات الواردة':'Incoming orders'} ({orders.length})</h2>
  {!orders.length?<p className="mt-2 text-xs text-ink-500">{ar?'الطلبات الجديدة هتظهر هنا.':'New orders appear here.'}</p>:
  <ul className="mt-2 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">{orders.map(o=><li key={o.id} className="min-w-0 rounded-lg border p-3 text-sm">
   <div className="flex items-center justify-between gap-2"><strong>#{o.order_number}</strong><span className="font-semibold">{formatMoney(Number(o.total),o.currency)}</span></div>
   {o.customer_details?.name&&<p className="mt-1 break-words">{o.customer_details.name}</p>}
   {o.customer_details?.phone&&<p className="text-xs text-ink-600"><bdi dir="ltr">{o.customer_details.phone}</bdi></p>}
   {o.restaurant_tables?.label&&<p className="text-xs text-ink-600">{o.restaurant_tables.label}</p>}
   <div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs text-ink-500">{o.order_items.reduce((sum,i)=>sum+i.quantity,0)} {ar?'صنف':'items'}{o.fiscal_state==='unpaid'&&(ar?' · غير مدفوع':' · Unpaid')}</span><Link href={`/dashboard/orders/${o.id}`} className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white">{ar?'الفاتورة والطباعة':'Invoice & print'}</Link></div>
  </li>)}</ul>}
 </section>;
}
