import Link from 'next/link';
import {requireBusinessModule} from '@/lib/business-access';
import {createServerSupabase} from '@/lib/supabase/server';
import {InvoiceExport} from '@/components/dashboard/InvoiceExport';
import {PageHeader} from '@/components/dashboard/Shell';
import {formatMoney} from '@/lib/utils';
export default async function InvoicesPage(){
 const member=await requireBusinessModule('invoices');const db=await createServerSupabase();const {data,error}=await db.from('orders').select('id,order_number,total,currency,created_at,customer_details,fiscal_state').eq('restaurant_id',member.restaurant.id).order('created_at',{ascending:false}).limit(100);
 if(error)throw Error('Could not load invoices');return <div className="mx-auto max-w-4xl space-y-4"><PageHeader title="الفواتير · Invoices" description="آخر 100 فاتورة · Latest 100 invoices"/><InvoiceExport/>{data?.map(o=><Link key={o.id} href={`/dashboard/invoices/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 ring-1 ring-black/5"><span>#{o.order_number} · {o.customer_details?.name}</span><span>{formatMoney(o.total,o.currency)} · {o.fiscal_state}</span></Link>)}</div>;
}
