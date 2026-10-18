import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {belmirAccess} from '@/lib/belmir/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const access=await belmirAccess();
 if(access.status===401)return Response.redirect(new URL('/login?next=/belmir/dashboard',request.url));
 if(!access.ok)return new Response('Belmir dashboard requires a MenuzQR administrator account.',{status:403});
 const html=await readFile(path.join(process.cwd(),'public/belmir-site/dashboard.html'),'utf8');
 return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});
}
