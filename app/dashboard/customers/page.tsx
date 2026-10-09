import {requireManager} from '@/lib/membership';
import {moduleEnabled} from '@/lib/business-modules';
import {notFound} from 'next/navigation';
import {createServerSupabase} from '@/lib/supabase/server';
import {saveCustomer} from '@/lib/actions/customers';
import {getLocale} from '@/lib/i18n/server';
export default async function CustomersPage({searchParams}:{searchParams:Promise<{q?:string}>}){
 const m=await requireManager('/dashboard/customers');if(!moduleEnabled(m.restaurant,'customers'))notFound();const ar=await getLocale()==='ar',q=(await searchParams).q?.trim().slice(0,160)??'';
 const db=await createServerSupabase();let query=db.from('business_customers').select('*').eq('restaurant_id',m.restaurant.id).order('created_at',{ascending:false}).limit(100);
 if(q){const safe=q.replace(/[%_,().]/g,'');query=query.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%,code.ilike.%${safe}%`);}
 const {data,error}=await query;if(error)throw new Error('Could not load customers');
 return <div className="mx-auto max-w-5xl space-y-5"><h1 className="text-2xl font-bold">{ar?'العملاء':'Customers'}</h1><p className="text-sm text-ink-500">{ar?'العملاء يُحفظون من الطلبات برقم الموبايل. يمكنك تعيين كود خاص مثل 55. الكود يظهر على الفواتير الجديدة؛ الفواتير القديمة تحتفظ ببياناتها وقت الطلب.':'Customers are saved from orders by phone. Assign a code such as 55. New invoices include it; historical invoices retain their original details.'}</p><form className="flex gap-2"><input name="q" defaultValue={q} placeholder={ar?'الاسم أو الموبايل أو الكود':'Name, phone or code'} className="min-w-0 flex-1 rounded-xl border p-3"/><button className="rounded-xl bg-ink-900 px-5 text-white">{ar?'بحث':'Search'}</button></form>{!data?.length&&<p>{ar?'لا يوجد عملاء بعد.':'No customers yet.'}</p>}{data?.map(c=><form action={saveCustomer} key={c.id} className="grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2"><input type="hidden" name="id" value={c.id}/><label>{ar?'كود العميل':'Customer code'}<input name="code" defaultValue={c.code??''} maxLength={40} placeholder="55" className="mt-1 w-full rounded-xl border p-3"/></label><label>{ar?'الاسم':'Name'}<input name="name" required minLength={2} maxLength={160} defaultValue={c.name} className="mt-1 w-full rounded-xl border p-3"/></label><p dir="ltr">{c.phone}</p><label>{ar?'العنوان':'Address'}<textarea name="address" defaultValue={c.address} maxLength={400} className="mt-1 w-full rounded-xl border p-3"/></label><button className="rounded-xl bg-ink-900 p-3 text-white">{ar?'حفظ':'Save'}</button></form>)}</div>;
}
