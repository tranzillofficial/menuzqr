"use client";
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {useI18n} from '@/components/i18n/I18nProvider';
import {FinancialControls} from './FinancialControls';
import {formatMoney} from '@/lib/utils';
import type {OrderWithDetails} from '@/lib/types';
export function IncomingOrders({orders}:{orders:OrderWithDetails[]}) {
 const router=useRouter();const {locale}=useI18n();const ar=locale==='ar';
 // Realtime refreshes immediately; polling recovers dropped notifications.
 useEffect(()=>{const id=window.setInterval(()=>{if(document.visibilityState==='visible')router.refresh();},20000);return ()=>clearInterval(id);},[router]);
 return <section className="mb-5 rounded-2xl border border-brand-200 bg-white p-4"><h2 className="font-semibold">{ar?'الطلبات الواردة من العملاء':'Incoming customer orders'} ({orders.length})</h2>{!orders.length?<p className="mt-2 text-sm text-ink-500">{ar?'الطلبات الجديدة من الرابط أو QR هتظهر هنا.':'New orders from the public link or QR appear here.'}</p>:<div className="mt-3 max-h-80 space-y-3 overflow-y-auto">{orders.map(o=><div key={o.id} className="rounded-xl border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><Link className="font-semibold text-brand-700" href={`/dashboard/orders/${o.id}`}>#{o.order_number} · {o.order_source==='online'?(ar?'طلب من الرابط':'Online order'):o.restaurant_tables?.label}</Link><span>{formatMoney(Number(o.total),o.currency)}</span></div><p className="my-2">{o.customer_details?.name} {o.customer_details?.phone} · {o.order_items.map(i=>`${i.quantity} × ${i.product_name}`).join('، ')}</p><p className="mb-2 text-xs text-ink-500">{o.fiscal_state==='unpaid'?(ar?'غير مدفوع — راجع التحويل مع العميل قبل تأكيد الدفع.':'Unpaid — check the transfer with the customer before confirming payment.'):o.fiscal_state}</p><div className="flex flex-wrap items-center gap-2"><Link href={`/dashboard/orders/${o.id}`} className="rounded-lg border px-3 py-2">{ar?'التفاصيل والفاتورة':'Details and invoice'}</Link><Link href="/dashboard/orders" className="rounded-lg border px-3 py-2">{ar?'متابعة الحالة':'Manage status'}</Link><FinancialControls orderId={o.id} state={o.fiscal_state} total={Number(o.total)}/></div></div>)}</div>}</section>;
}
