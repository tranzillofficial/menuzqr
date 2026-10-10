import {validPrintTicket} from '@/lib/print-pairing';
export async function POST(request:Request){
 if(Number(request.headers.get('content-length')??0)>4096)return new Response(null,{status:413});
 try{
  const text=await request.text();
  if(text.length>4096)return new Response(null,{status:413});
  const {ticket,origin}=JSON.parse(text);
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ok=Boolean(secret&&validPrintTicket(ticket,origin,secret));
  return Response.json({ok},{status:ok?200:403,headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({ok:false},{status:400});}
}
