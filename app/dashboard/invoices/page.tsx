import Link from 'next/link';
import {requireBusinessModule} from '@/lib/business-access';
import {createServerSupabase} from '@/lib/supabase/server';
import {InvoiceExport} from '@/components/dashboard/InvoiceExport';
import {FinanceNavigation,FinanceHeading} from '@/components/dashboard/FinanceNavigation';
import {FinanceInvoiceList,type InvoiceListRow} from '@/components/dashboard/FinanceInvoiceList';
import {InvoiceOverview,type InvoiceOverviewData} from '@/components/dashboard/InvoiceOverview';
import {moduleEnabled} from '@/lib/business-modules';
import {cn} from '@/lib/utils';
import {businessDayRange} from '@/lib/business-time';
import {getLocale} from '@/lib/i18n/server';
export default async function InvoicesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const [member,db,locale,query]=await Promise.all([requireBusinessModule('invoices'),createServerSupabase(),getLocale(),searchParams]);
 const l=(ar:string,en:string)=>locale==='ar'?ar:en;
 const value=(key:string)=>typeof query[key]==='string'?query[key] as string:'';
 const q=value('q').slice(0,80).replace(/[,%()_*\\]/g,' ').trim(),state=['paid','unpaid','refunded','void','legacy'].includes(value('state'))?value('state'):'',payment=['cash','card','transfer'].includes(value('payment'))?value('payment'):'';
 const page=Math.min(10000,Math.max(1,Math.floor(Number(value('page'))||1)));
 let request=db.from('orders').select('id,order_number,total,currency,created_at,customer_details,fiscal_state,payment_method,fiscal_snapshot,order_source,restaurant_tables(label),order_items(product_name,variant_name,quantity,line_total)', {count:'exact'}).eq('restaurant_id',member.restaurant.id);
 if(q)request=/^\d+$/.test(q)?request.eq('order_number',Number(q)):request.or(`customer_details->>name.ilike.%${q}%,fiscal_snapshot->customer->>name.ilike.%${q}%`);
 if(state)request=request.eq('fiscal_state',state);if(payment)request=request.eq('payment_method',payment);
 let from='',to='';
 try{if(value('from')){const range=businessDayRange(value('from'),member.restaurant.business_timezone);from=value('from');request=request.gte('created_at',range.start);}if(value('to')){const range=businessDayRange(value('to'),member.restaurant.business_timezone);to=value('to');request=request.lt('created_at',range.end);}}catch{/* Invalid dates are ignored, never interpolated into database filters. */}
 const {data,error,count}=await request.order('created_at',{ascending:false}).order('id').range((page-1)*30,page*30-1);
 if(error)throw Error('Could not load invoices');const rows=data??[],pages=Math.max(1,Math.ceil((count??0)/30));
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:member.restaurant.business_timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const overview=await db.rpc('invoice_overview',{p_restaurant:member.restaurant.id,p_day:today});if(overview.error)throw Error('Could not load invoice summary');
 const states:Record<string,string>={paid:l('مدفوعة','Paid'),unpaid:l('غير مدفوعة','Unpaid'),refunded:l('مستردة','Refunded'),void:l('ملغاة','Voided'),legacy:l('تاريخية','Historical')};
 const payments:Record<string,string>={cash:l('كاش','Cash'),card:l('بطاقة','Card'),transfer:l('تحويل','Transfer')};
 const link=(next:number)=>{const params=new URLSearchParams({q,state,payment,from,to,page:String(next)});return `/dashboard/invoices?${params}`;};
 const field='h-10 min-w-0 w-full rounded-xl border border-ink-100 bg-ink-50/60 px-3 text-xs outline-none focus:border-brand-300 sm:text-sm';
 return <div className="mx-auto max-w-6xl space-y-4">
  <FinanceHeading ar={locale==='ar'} description={l('طلباتك وفواتيرك وتقارير المبيعات في مكان واحد.','Orders, invoices and sales reports in one place.')}/>
  <FinanceNavigation config={member.restaurant} active="invoices" ar={locale==='ar'}/>
  <InvoiceOverview overview={overview.data as InvoiceOverviewData} ar={locale==='ar'}/>
  <section className="rounded-2xl bg-white p-3 ring-1 ring-black/5 sm:p-5"><form className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
   <label className="col-span-2 text-xs font-medium lg:col-span-2">{l('ابحث برقم الفاتورة أو اسم العميل','Invoice number or customer name')}<input name="q" defaultValue={q} placeholder={l('بحث في الفواتير…','Search invoices…')} className={`${field} mt-2`}/></label>
   <label className="text-xs font-medium">{l('حالة الدفع','Payment status')}<select name="state" defaultValue={state} className={`${field} mt-2`}><option value="">{l('كل الحالات','All statuses')}</option>{Object.entries(states).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <label className="text-xs font-medium">{l('طريقة الدفع','Payment method')}<select name="payment" defaultValue={payment} className={`${field} mt-2`}><option value="">{l('كل الطرق','All methods')}</option>{Object.entries(payments).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <label className="text-xs font-medium">{l('من تاريخ','From')}<input type="date" name="from" defaultValue={from} className={`${field} mt-2`}/></label>
   <label className="text-xs font-medium">{l('إلى تاريخ','To')}<input type="date" name="to" defaultValue={to} className={`${field} mt-2`}/></label>
   <div className="col-span-2 flex items-center gap-3 sm:col-span-3 lg:col-span-6"><button className="rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-semibold text-white">{l('عرض النتائج','Apply filters')}</button><Link href="/dashboard/invoices" className="text-xs text-ink-500">{l('مسح الفلاتر','Reset filters')}</Link><span className="ms-auto text-[11px] text-ink-400">{l('30 فاتورة لكل صفحة','30 invoices per page')}</span></div>
  </form></section>
  <FinanceInvoiceList key={`${q}:${state}:${payment}:${from}:${to}:${page}`} rows={rows as unknown as InvoiceListRow[]} timezone={member.restaurant.business_timezone}/>
  <nav className="flex items-center justify-between text-xs" aria-label={l('صفحات الفواتير','Invoice pages')}><Link aria-disabled={page<=1} tabIndex={page<=1?-1:0} href={link(Math.max(1,page-1))} className={cn('rounded-xl bg-white px-4 py-2.5 ring-1 ring-black/5',page<=1&&'pointer-events-none opacity-40')}>{l('السابق','Previous')}</Link><span>{page} / {pages}</span><Link aria-disabled={page>=pages} tabIndex={page>=pages?-1:0} href={link(page+1)} className={cn('rounded-xl bg-white px-4 py-2.5 ring-1 ring-black/5',page>=pages&&'pointer-events-none opacity-40')}>{l('التالي','Next')}</Link></nav>
  {moduleEnabled(member.restaurant,'pos')&&<Link href="/dashboard/pos" className="flex items-center justify-center rounded-xl bg-brand-600 px-4 py-3 text-xs font-semibold text-white sm:w-fit">+ {l('فاتورة جديدة','New invoice')}</Link>}
  <details className="rounded-2xl bg-white p-4 ring-1 ring-black/5"><summary className="cursor-pointer text-xs font-semibold">{l('حفظ وتصدير الفواتير','Save & export invoices')}</summary><div className="mt-4"><InvoiceExport/></div></details>
 </div>;
}
