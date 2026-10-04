import 'server-only';
import {createServerSupabase} from './supabase/server';
import type {OrderWithDetails} from './types';
export async function activeOrders(restaurantId:string,incomingOnly=false):Promise<OrderWithDetails[]> {
 const db=await createServerSupabase(),orders:OrderWithDetails[]=[];
 for(let offset=0;;offset+=200){let query=db.from('orders').select('*,order_items(*),restaurant_tables(id,label)').eq('restaurant_id',restaurantId).in('status',['pending','accepted','preparing','ready']).order('order_number',{ascending:false}).range(offset,offset+199);if(incomingOnly)query=query.or('order_source.eq.online,table_id.not.is.null');const {data,error}=await query;if(error)throw new Error('Could not load active orders');orders.push(...(data??[]) as OrderWithDetails[]);if((data?.length??0)<200)return orders;}
}
