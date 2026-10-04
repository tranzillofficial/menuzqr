import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import {getTenantDomain} from '@/lib/tenant-domain';
import {MenuImage} from '@/components/menu/MenuMedia';
import {getPublicMenu} from '@/lib/menu-data';
export const dynamic='force-dynamic';
export default async function BusinessSite(){
 const domain=await getTenantDomain();if(!domain)notFound();
 if(domain.home_mode==='login')redirect('/login');
 const r=domain.restaurants;const result=await getPublicMenu(r.slug);
 if(result.state!=='ok'){
  // The existing menu route displays the account's activation state.
  redirect('/menu');
 }
 const ar=r.language==='ar';
 return <main dir={ar?'rtl':'ltr'} className="min-h-screen bg-[#faf7f2] text-ink-900"><header className="flex items-center justify-between gap-4 px-5 py-4"><span className="font-semibold">{r.name}</span><Link href="/login" className="rounded-xl border bg-white px-4 py-2 text-sm">{ar?'دخول الموظفين':'Staff login'}</Link></header>{r.cover_url&&<MenuImage src={r.cover_url} alt={r.name} priority fit="cover" sizes="100vw" className="h-56 w-full sm:h-80"/>}<section className="mx-auto max-w-3xl space-y-5 px-6 py-12 text-center">{r.logo_url&&<MenuImage src={r.logo_url} alt={r.name} priority className="mx-auto size-24 rounded-2xl bg-white" sizes="96px"/>}<h1 className="text-3xl font-bold sm:text-5xl">{r.name}</h1>{r.description&&<p className="text-base leading-8 text-ink-600">{r.description}</p>}<Link href="/menu" className="inline-flex rounded-xl bg-ink-900 px-6 py-3 font-semibold text-white">{ar?'تصفّح الأصناف':'Browse products'}</Link><div className="space-y-2 text-sm text-ink-600">{r.address&&<p>{r.address}</p>}{r.phone&&<a href={`tel:${r.phone}`} dir="ltr" className="inline-block">{r.phone}</a>}</div></section></main>;
}
