import {featureEnabled} from '@/lib/business-features';
import {requireBusinessModule} from '@/lib/business-access';
import {createServerSupabase} from '@/lib/supabase/server';
import {CustomersManager,type CustomerDirectory} from '@/components/dashboard/CustomersManager';
export default async function CustomersPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [m,db,params]=await Promise.all([requireBusinessModule('customers'),createServerSupabase(),searchParams]);const value=(key:string)=>typeof params[key]==='string'?params[key] as string:'';
 const q=value('q').trim().slice(0,160).replace(/[%_]/g,''),filter=['active','new','repeat'].includes(value('filter'))?value('filter'):'all',sort=['name','recent'].includes(value('sort'))?value('sort'):'newest',page=Math.min(10000,Math.max(1,Math.floor(Number(value('page'))||1)));
 const {data,error}=await db.rpc('customer_directory',{p_restaurant:m.restaurant.id,p_query:q,p_filter:filter,p_sort:sort,p_page:page});if(error)throw Error('Could not load customers');
 return <CustomersManager allowCreate={featureEnabled(m.restaurant,"customer_create")} allowEdit={featureEnabled(m.restaurant,"customer_edit")} key={`${q}:${filter}:${sort}:${page}`} directory={data as CustomerDirectory} query={q} filter={filter} sort={sort} page={page} timezone={m.restaurant.business_timezone}/>;
}
