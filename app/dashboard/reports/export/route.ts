import {moduleEnabled} from '@/lib/business-modules';
import {NextRequest,NextResponse} from 'next/server';
import {getMembership} from '@/lib/membership';
import {createAdminSupabase} from '@/lib/supabase/admin';
import {businessDayRange} from '@/lib/business-time';
export const dynamic='force-dynamic';
const cell=(value:unknown)=>`"${String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')}"`;
export async function GET(request:NextRequest){
 const member=await getMembership();if(!member?.isManager || !moduleEnabled(member.restaurant,"reports"))return new NextResponse('Forbidden',{status:403});
 const params=request.nextUrl.searchParams,kind=params.get('kind')??'events',db=createAdminSupabase();
 if(kind==='z'){
  const {data,error}=await db.from('z_reports').select('*').eq('restaurant_id',member.restaurant.id).eq('id',params.get('id')??'').maybeSingle();
  if(error||!data)return new NextResponse('Report not found',{status:404});
  return new NextResponse(JSON.stringify(data,null,2),{headers:{'Content-Type':'application/json','Content-Disposition':`attachment; filename="Z-${data.report_number}.json"`,'Cache-Control':'no-store'}});
 }
 if(!['events','audit'].includes(kind))return new NextResponse('Invalid export',{status:400});
 const date=params.get('date')??'';let range:{start:string;end:string};try{range=businessDayRange(date,member.restaurant.business_timezone);}catch{return new NextResponse('Invalid date',{status:400});}
 const columns=kind==='audit'?['id','created_at','entity','entity_id','order_id','action','actor_id','actor_name','reason','before_data','after_data']:['id','created_at','order_id','document_number','kind','currency','payment_method','net','vat','gross','breakdown','actor_id','actor_name','reason','invoice_details'];
 const csv=[columns.map(cell).join(',')];let offset=0;
 for(;;){const {data,error}=await db.from(kind==='audit'?'order_audit':'financial_events').select(kind==='audit'?'*':'*,orders(order_number,fiscal_snapshot,order_items(product_name,variant_name,unit_price,quantity,line_total,net_total,vat_total,vat_code,vat_rate))').eq('restaurant_id',member.restaurant.id).gte('created_at',range.start).lt('created_at',range.end).order('id').range(offset,offset+999);if(error)return new NextResponse('Export failed',{status:500});for(const row of (data??[]) as unknown as Record<string,unknown>[]){if(kind==='events')row.invoice_details=row.orders;csv.push(columns.map(c=>cell(typeof row[c]==='object'&&row[c]!==null?JSON.stringify(row[c]):row[c])).join(','));}if(!data||data.length<1000)break;offset+=1000;}
 return new NextResponse('\uFEFF'+csv.join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${kind}-${date}.csv"`,'Cache-Control':'no-store'}});
}
