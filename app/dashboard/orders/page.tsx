import Link from 'next/link';
import {moduleEnabled} from '@/lib/business-modules';
import {requireBusinessModule} from '@/lib/business-access';
import {createServerSupabase} from '@/lib/supabase/server';
import {getLocale} from '@/lib/i18n/server';
import {FinanceNavigation,FinanceHeading} from '@/components/dashboard/FinanceNavigation';
import {OrdersBoard} from '@/components/dashboard/OrdersBoard';
import type {OrderWithDetails,WaiterRequest} from '@/lib/types';
export const metadata={title:'Invoices · Orders'};
export default async function OrdersPage({searchParams}:{searchParams:Promise<{tab?:string;page?:string;q?:string}>}){
 const [m,db,locale,params]=await Promise.all([requireBusinessModule('orders'),createServerSupabase(),getLocale(),searchParams]);const restaurant=m.restaurant,ar=locale==='ar',tab=params.tab==='done'?'done':'open',page=Math.min(10000,Math.max(1,Math.floor(Number(params.page)||1))),q=String(params.q??'').slice(0,80).replace(/[,%()_*\\]/g,' ').trim();
 let request=db.from('orders').select('*,order_items(*),restaurant_tables(id,label)',{count:'exact'}).eq('restaurant_id',restaurant.id).in('status',tab==='open'?['pending','accepted','preparing','ready']:['completed','cancelled']);
 if(q)request=/^\d+$/.test(q)?request.eq('order_number',Number(q)):request.or(`customer_details->>name.ilike.%${q}%,customer_details->>phone.ilike.%${q}%`);
 const [orders,waiters]=await Promise.all([request.order('created_at',{ascending:false}).order('id').range((page-1)*30,page*30-1),moduleEnabled(restaurant,'service_calls')&&moduleEnabled(restaurant,'tables')?db.from('waiter_requests').select('*,restaurant_tables(id,label)').eq('restaurant_id',restaurant.id).eq('status','pending').order('created_at').limit(30):Promise.resolve({data:[],error:null})]);
 if(orders.error||waiters.error)throw Error('Could not load orders');const pages=Math.max(1,Math.ceil((orders.count??0)/30)),href=(n:number)=>`/dashboard/orders?${new URLSearchParams({tab,q,page:String(n)})}`;
 return <div className="mx-auto max-w-6xl space-y-4"><FinanceHeading ar={ar} description={ar?'تابع الطلبات والمدفوعات واطبع الفاتورة.':'Track orders and payments and print invoices.'}/><FinanceNavigation config={restaurant} active="orders" ar={ar}/><form className="flex gap-2 rounded-2xl bg-white p-3 ring-1 ring-black/5"><input name="tab" type="hidden" value={tab}/><input name="q" defaultValue={q} aria-label={ar?'بحث الطلبات':'Search orders'} placeholder={ar?'رقم الطلب أو اسم العميل أو الموبايل…':'Order number, customer or phone…'} className="h-10 min-w-0 flex-1 rounded-xl border border-ink-100 px-3 text-xs"/><button className="rounded-xl bg-brand-600 px-4 text-xs text-white">{ar?'بحث':'Search'}</button></form><OrdersBoard key={`${tab}:${page}:${q}`} initialTab={tab} orders={(orders.data??[]) as OrderWithDetails[]} waiterRequests={(waiters.data??[]) as WaiterRequest[]} currency={restaurant.currency} retail={!moduleEnabled(restaurant,'tables')}/><nav className="flex items-center justify-between text-xs"><Link href={href(Math.max(1,page-1))} aria-disabled={page<=1} className={page<=1?'pointer-events-none opacity-40':''}>{ar?'السابق':'Previous'}</Link><span>{page} / {pages} · {orders.count??0} {ar?'طلب':'orders'}</span><Link href={href(page+1)} aria-disabled={page>=pages} className={page>=pages?'pointer-events-none opacity-40':''}>{ar?'التالي':'Next'}</Link></nav></div>;
}
