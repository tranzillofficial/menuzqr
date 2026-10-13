import Link from 'next/link';
import {requireBusinessModule} from '@/lib/business-access';
import {createServerSupabase} from '@/lib/supabase/server';
import {InvoiceExport} from '@/components/dashboard/InvoiceExport';
import {formatMoney,cn} from '@/lib/utils';
import {businessDayRange} from '@/lib/business-time';
import {getLocale} from '@/lib/i18n/server';
export default async function InvoicesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const [member,db,locale,query]=await Promise.all([requireBusinessModule('invoices'),createServerSupabase(),getLocale(),searchParams]);
 const l=(ar:string,en:string)=>locale==='ar'?ar:en;
 const value=(key:string)=>typeof query[key]==='string'?query[key] as string:'';
 const q=value('q').slice(0,80).replace(/[,%()_*\\]/g,' ').trim(),state=['paid','unpaid','refunded','void','legacy'].includes(value('state'))?value('state'):'',payment=['cash','card','transfer'].includes(value('payment'))?value('payment'):'';
 const page=Math.min(10000,Math.max(1,Math.floor(Number(value('page'))||1)));
 let request=db.from('orders').select('id,order_number,total,currency,created_at,customer_details,fiscal_state,payment_method,fiscal_snapshot', {count:'exact'}).eq('restaurant_id',member.restaurant.id);
 if(q)request=/^\d+$/.test(q)?request.eq('order_number',Number(q)):request.or(`customer_details->>name.ilike.%${q}%,fiscal_snapshot->customer->>name.ilike.%${q}%`);
 if(state)request=request.eq('fiscal_state',state);if(payment)request=request.eq('payment_method',payment);
 let from='',to='';
 try{if(value('from')){const range=businessDayRange(value('from'),member.restaurant.business_timezone);from=value('from');request=request.gte('created_at',range.start);}if(value('to')){const range=businessDayRange(value('to'),member.restaurant.business_timezone);to=value('to');request=request.lt('created_at',range.end);}}catch{/* Invalid dates are ignored, never interpolated into database filters. */}
 const {data,error,count}=await request.order('created_at',{ascending:false}).order('id').range((page-1)*30,page*30-1);
 if(error)throw Error('Could not load invoices');const rows=data??[],pages=Math.max(1,Math.ceil((count??0)/30));
 const states:Record<string,string>={paid:l('مدفوعة','Paid'),unpaid:l('غير مدفوعة','Unpaid'),refunded:l('مستردة','Refunded'),void:l('ملغاة','Voided'),legacy:l('تاريخية','Historical')};
 const payments:Record<string,string>={cash:l('كاش','Cash'),card:l('بطاقة','Card'),transfer:l('تحويل','Transfer')};
 const link=(next:number)=>{const params=new URLSearchParams({q,state,payment,from,to,page:String(next)});return `/dashboard/invoices?${params}`;};
 const field='h-10 min-w-0 w-full rounded-xl border border-ink-100 bg-ink-50/60 px-3 text-xs outline-none focus:border-brand-300 sm:text-sm';
 return <div className="mx-auto max-w-6xl space-y-4">
  <header className="flex items-center justify-between gap-3"><div><h1 className="text-xl font-semibold sm:text-2xl">{l('الفواتير','Invoices')}</h1><p className="mt-1 text-xs text-ink-500 sm:text-sm">{l('فواتير البيع، تفاصيل الدفع وخصومات العروض.','Sales invoices, payments and offer discounts.')}</p></div><span className="shrink-0 rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700">{count??0} {l('فاتورة','invoices')}</span></header>
  <section className="rounded-2xl bg-white p-3 ring-1 ring-black/5 sm:p-5"><form className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
   <label className="col-span-2 text-xs font-medium lg:col-span-2">{l('ابحث برقم الفاتورة أو اسم العميل','Invoice number or customer name')}<input name="q" defaultValue={q} placeholder={l('بحث في الفواتير…','Search invoices…')} className={`${field} mt-2`}/></label>
   <label className="text-xs font-medium">{l('حالة الدفع','Payment status')}<select name="state" defaultValue={state} className={`${field} mt-2`}><option value="">{l('كل الحالات','All statuses')}</option>{Object.entries(states).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <label className="text-xs font-medium">{l('طريقة الدفع','Payment method')}<select name="payment" defaultValue={payment} className={`${field} mt-2`}><option value="">{l('كل الطرق','All methods')}</option>{Object.entries(payments).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <label className="text-xs font-medium">{l('من تاريخ','From')}<input type="date" name="from" defaultValue={from} className={`${field} mt-2`}/></label>
   <label className="text-xs font-medium">{l('إلى تاريخ','To')}<input type="date" name="to" defaultValue={to} className={`${field} mt-2`}/></label>
   <div className="col-span-2 flex items-center gap-3 sm:col-span-3 lg:col-span-6"><button className="rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-semibold text-white">{l('عرض النتائج','Apply filters')}</button><Link href="/dashboard/invoices" className="text-xs text-ink-500">{l('مسح الفلاتر','Reset filters')}</Link><span className="ms-auto text-[11px] text-ink-400">{l('30 فاتورة لكل صفحة','30 invoices per page')}</span></div>
  </form></section>
  <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
   <div className="hidden grid-cols-[.7fr_1.3fr_1fr_.8fr_1fr_.6fr] gap-3 bg-ink-50 px-5 py-3 text-xs text-ink-500 md:grid">{[l('الفاتورة','Invoice'),l('العميل والتاريخ','Customer & date'),l('حالة الدفع','Status'),l('الدفع','Payment'),l('الإجمالي','Total'),l('التفاصيل','Details')].map(h=><span key={h}>{h}</span>)}</div>
   {rows.map(o=><Link key={o.id} href={`/dashboard/invoices/${o.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-ink-100 p-3 last:border-0 hover:bg-brand-50/30 sm:p-5 md:grid-cols-[.7fr_1.3fr_1fr_.8fr_1fr_.6fr]">
    <strong className="text-sm">#{o.order_number}<span className="mt-1 block text-[11px] font-normal text-ink-500 md:hidden">{o.customer_details?.name||o.fiscal_snapshot?.customer?.name||l('عميل نقدي','Walk-in customer')}</span></strong>
    <div className="hidden min-w-0 md:block"><p className="truncate text-xs">{o.customer_details?.name||o.fiscal_snapshot?.customer?.name||l('عميل نقدي','Walk-in customer')}</p><p className="mt-1 text-[11px] text-ink-400">{new Date(o.created_at).toLocaleString(locale==='ar'?'ar-EG':'en-GB',{timeZone:member.restaurant.business_timezone,dateStyle:'short',timeStyle:'short'})}</p></div>
    <span className={cn('w-fit rounded-full px-2.5 py-1 text-[11px]',o.fiscal_state==='paid'?'bg-emerald-50 text-emerald-700':o.fiscal_state==='unpaid'?'bg-amber-50 text-amber-700':'bg-ink-100 text-ink-600')}>{states[o.fiscal_state]??o.fiscal_state}</span>
    <span className="text-[11px] text-ink-500 md:text-xs">{payments[o.payment_method??'']??'—'}<span className="ms-2 md:hidden">{new Date(o.created_at).toLocaleDateString(locale==='ar'?'ar-EG':'en-GB',{timeZone:member.restaurant.business_timezone})}</span></span>
    <div className="text-end md:text-start"><strong className="text-sm">{formatMoney(Number(o.total),o.currency)}</strong>{Number(o.fiscal_snapshot?.discount_total)>0&&<p className="mt-1 text-[10px] text-brand-600">{l('خصم','Discount')} {formatMoney(Number(o.fiscal_snapshot.discount_total),o.currency)}</p>}</div>
    <span className="hidden text-xs text-brand-600 md:block">{l('عرض ←','View →')}</span>
   </Link>)}
   {!rows.length&&<div className="px-4 py-14 text-center"><p className="text-sm font-semibold">{l('لا توجد فواتير مطابقة','No matching invoices')}</p><p className="mt-2 text-xs text-ink-500">{l('راجع الفلاتر أو سجّل أول عملية بيع من الكاشير.','Check your filters or record a sale in POS.')}</p></div>}
  </section>
  <nav className="flex items-center justify-between text-xs" aria-label={l('صفحات الفواتير','Invoice pages')}><Link aria-disabled={page<=1} tabIndex={page<=1?-1:0} href={link(Math.max(1,page-1))} className={cn('rounded-xl bg-white px-4 py-2.5 ring-1 ring-black/5',page<=1&&'pointer-events-none opacity-40')}>{l('السابق','Previous')}</Link><span>{page} / {pages}</span><Link aria-disabled={page>=pages} tabIndex={page>=pages?-1:0} href={link(page+1)} className={cn('rounded-xl bg-white px-4 py-2.5 ring-1 ring-black/5',page>=pages&&'pointer-events-none opacity-40')}>{l('التالي','Next')}</Link></nav>
  <InvoiceExport/>
 </div>;
}
