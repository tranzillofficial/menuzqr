import { domainToASCII } from 'node:url';
export function normalizeDomain(input:string):string|null {
 const raw=input.trim().toLowerCase().replace(/\.$/,'');
 if(!raw||raw.includes('://')||/[/:?#@\\\s]/.test(raw))return null;
 const host=domainToASCII(raw);
 if(!host||host.length>253||!host.includes('.')||/^\d+(\.\d+){3}$/.test(host))return null;
 if(host.split('.').some(p=>!p||p.length>63||! /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(p)))return null;
 if(host==='localhost'||host.endsWith('.localhost')||host==='menuzqr.shop'||host.endsWith('.menuzqr.shop')||host.endsWith('.vercel.app'))return null;
 return host;
}
export function isPlatformHost(host:string){
 const configured=process.env.NEXT_PUBLIC_SITE_URL;let base='';try{base=new URL(configured??'https://menuzqr.shop').hostname;}catch{}
 return host===base||host==='menuzqr.shop'||host==='www.menuzqr.shop'||host.endsWith('.vercel.app')||host==='localhost'||host==='127.0.0.1';
}
