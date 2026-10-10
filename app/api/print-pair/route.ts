import {getMembership} from '@/lib/membership';
import {createPrintTicket} from '@/lib/print-pairing';
export async function POST(request:Request){
 const origin=request.headers.get('origin');
 let validOrigin=false;
 try{validOrigin=Boolean(origin&&new URL(origin).origin===origin&&new URL(origin).host===request.headers.get('host')&&origin.startsWith('https://'));}catch{}
 if(!origin||!validOrigin)return Response.json({error:'Invalid origin'},{status:403});
 const member=await getMembership();
 if(!member?.isManager)return Response.json({error:'Sign in as an owner or manager to connect this computer.'},{status:403});
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret)return Response.json({error:'Pairing unavailable'},{status:503});
 return Response.json({ticket:createPrintTicket(origin,secret)},{headers:{'Cache-Control':'no-store'}});
}
