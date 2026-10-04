import {NextResponse,type NextRequest} from 'next/server';
import {updateSession} from './lib/supabase/proxy';
import {findTenantDomain} from './lib/tenant-domain';
import {isPlatformHost} from './lib/domain-names';
import {dashboardPathEnabled} from './lib/business-modules';
const PROTECTED=['/dashboard','/admin','/station'];
const AUTH_PAGES=['/login','/signup'];
export async function proxy(request:NextRequest){
 const {pathname}=request.nextUrl;
 const host=(request.headers.get('host')??'').split(':')[0].toLowerCase();
 const domain=await findTenantDomain(host);
 const protectedPath=PROTECTED.some(p=>pathname===p||pathname.startsWith(p+'/'));
 if(!isPlatformHost(host)&&!domain)return new NextResponse('Domain is not active',{status:404});
 if(domain){
  if(pathname==='/admin'||pathname.startsWith('/admin/')||pathname==='/signup')return new NextResponse('Not found',{status:404});
  if(!protectedPath&&!AUTH_PAGES.includes(pathname)){
   const url=request.nextUrl.clone();
   if(pathname==='/'){url.pathname='/business-site';return NextResponse.rewrite(url);}
   if(pathname==='/menu'){url.pathname=`/${domain.restaurants.slug}/menu`;return NextResponse.rewrite(url);}
   if(pathname!==`/${domain.restaurants.slug}/menu`&&!pathname.startsWith('/api/')&&!pathname.startsWith('/auth/')&&pathname!=='/disabled')return new NextResponse('Not found',{status:404});
  }
 }
 if(!protectedPath&&!AUTH_PAGES.includes(pathname))return NextResponse.next();
 const {response,user,supabase}=await updateSession(request);
 if(!user&&protectedPath){const url=request.nextUrl.clone();url.pathname='/login';url.searchParams.set('next',pathname);const redirect=NextResponse.redirect(url);response.cookies.getAll().forEach(c=>redirect.cookies.set(c));return redirect;}
 if(user&&protectedPath){
  const {data:members}=await supabase.from('restaurant_members').select('restaurant_id,role,restaurants(enabled_modules,business_kind)').eq('user_id',user.id).eq('is_active',true).order('created_at');
  const member=domain?members?.find(m=>m.restaurant_id===domain.restaurant_id):members?.sort((a,b)=>['owner','manager','chef','waiter','staff'].indexOf(a.role)-['owner','manager','chef','waiter','staff'].indexOf(b.role))[0];
  if(domain&&!member)return new NextResponse('This account does not belong to this business',{status:403});
  const joined=member?.restaurants;const business=Array.isArray(joined)?joined[0]:joined;
  if(pathname.startsWith('/dashboard/')&&business&&!dashboardPathEnabled(business,pathname))return new NextResponse('This module is disabled for your account',{status:403});
 }
 if(user&&AUTH_PAGES.includes(pathname)){const url=request.nextUrl.clone();url.pathname='/dashboard';url.search='';const redirect=NextResponse.redirect(url);response.cookies.getAll().forEach(c=>redirect.cookies.set(c));return redirect;}
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|ico|css|js|woff2?|json)$).*)']};
