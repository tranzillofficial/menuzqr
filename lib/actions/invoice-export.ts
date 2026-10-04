"use server";
import {getMembership} from '@/lib/membership';
import {createAdminSupabase} from '@/lib/supabase/admin';
import {invoiceHtml,type ExportInvoice} from '@/lib/invoice-export';
export async function exportInvoiceBatch(after:number,cutoff:string) {
 const member=await getMembership();if(!member?.isManager)throw new Error('Manager access required');
 if(!Number.isInteger(after)||after<0||!Number.isFinite(Date.parse(cutoff))||Date.parse(cutoff)>Date.now()+60000)throw new Error('Invalid export range');
 const {data,error}=await createAdminSupabase().from('orders').select('id,order_number,created_at,status,fiscal_state,currency,total,payment_method,paid_at,note,fiscal_snapshot,customer_details,order_items(product_name,variant_name,quantity,unit_price,line_total,vat_rate,vat_total),financial_events(*),vat_documents(*)').eq('restaurant_id',member.restaurant.id).gt('order_number',after).lte('created_at',cutoff).order('order_number').limit(50);
 if(error)throw new Error('Could not export invoices');
 const invoices=(data??[]) as ExportInvoice[];
 return {next:invoices.at(-1)?.order_number??after,done:invoices.length<50,count:invoices.length,files:invoices.flatMap(o=>[{name:`invoice-${o.order_number}.html`,content:invoiceHtml(o,member.restaurant.name)},{name:`invoice-${o.order_number}.json`,content:JSON.stringify(o,null,2)}])};
}
