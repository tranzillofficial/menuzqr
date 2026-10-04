import 'server-only';
import {cache} from 'react';
import {headers} from 'next/headers';
import {createAdminSupabase} from './supabase/admin';
import {isPlatformHost} from './domain-names';
import type {Restaurant} from './types';
export type DnsDetails={verification?:{type:string;domain:string;value:string}[];recommendedCNAME?:{rank:number;value:string}[];recommendedIPv4?:{rank:number;value:string[]}[];misconfigured?:boolean};
export type TenantDomain={id:string;hostname:string;restaurant_id:string;home_mode:'landing'|'login';status:'pending'|'active';enabled:boolean;verification:DnsDetails;checked_at:string|null;restaurants:Restaurant};
export async function findTenantDomain(host:string):Promise<TenantDomain|null>{
 if(isPlatformHost(host))return null;
 const {data,error}=await createAdminSupabase().from('business_domains').select('*,restaurants(*)').eq('hostname',host).eq('status','active').eq('enabled',true).maybeSingle();
 if(error)throw new Error('Could not resolve business domain');
 return data as TenantDomain|null;
}
export const getTenantDomain=cache(async()=>{const host=(await headers()).get('host')?.split(':')[0].toLowerCase()??'';return findTenantDomain(host);});

export async function businessMenuUrl(restaurant:Pick<Restaurant,'id'|'slug'>){
 const {data,error}=await createAdminSupabase().from('business_domains').select('hostname').eq('restaurant_id',restaurant.id).eq('status','active').eq('enabled',true).order('created_at').limit(1).maybeSingle();
 if(error)throw new Error('Could not load business URL');
 if(data)return `https://${data.hostname}/menu`;
 const {absoluteUrl}=await import('./utils');return absoluteUrl(`/${restaurant.slug}/menu`);
}
