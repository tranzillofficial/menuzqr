import {PrintReportButton} from "@/components/dashboard/PrintReportButton";
import {notFound} from 'next/navigation';
import {requireManager} from '@/lib/membership';
import {createServerSupabase} from '@/lib/supabase/server';
import {getLocale} from '@/lib/i18n/server';
import {SalesSummary} from '@/components/dashboard/SalesSummary';
import type {SalesSummary as Summary} from '@/lib/tax';
export default async function ZReport({params}:{params:Promise<{id:string}>}){
 const [member,db,locale,{id}]=await Promise.all([requireManager(),createServerSupabase(),getLocale(),params]);const {data:z}=await db.from('z_reports').select('*').eq('id',id).eq('restaurant_id',member.restaurant.id).maybeSingle();if(!z)notFound();
 return <div className="space-y-5"><PrintReportButton/><article id="pos-receipt" data-report="true" className="space-y-5"><h1 className="text-2xl font-semibold">Z / End of Day Report #{z.report_number}</h1><p>{z.business_date} · {z.timezone}</p><p className="text-sm">{z.closed_by_name} · {new Date(z.closed_at).toLocaleString('en-GB',{timeZone:z.timezone})}</p><p className="text-xs text-ink-500">{locale==='ar'?'تقرير ثابت للعمليات منذ الإغلاق السابق.':'Immutable report of events since the preceding close.'} {z.from_event_id} → {z.through_event_id}</p><a className="inline-block rounded-xl border bg-white px-4 py-2 text-sm" href={`/dashboard/reports/export?kind=z&id=${id}`}>Download JSON</a><SalesSummary summary={z.summary as Summary} ar={locale==='ar'}/></article></div>;
}
