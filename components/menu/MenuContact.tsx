"use client";
import {useMenu} from './MenuContext';
import {useI18n} from '@/components/i18n/I18nProvider';
import {Icon} from '@/components/ui/Icons';
import {contactPhones,safeContactUrl} from '@/lib/menu-contact';
import {normalizeWhatsapp} from '@/lib/phone';
import type {SVGProps} from 'react';
function ContactIcon({kind,...props}:SVGProps<SVGSVGElement>&{kind:string}){
 if(kind==='whatsapp')return <Icon.whatsapp {...props}/>;
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>{kind==='phone'?<path d="m5 3 4 1 1 5-2 2a15 15 0 0 0 5 5l2-2 5 1 1 4c0 2-2 3-4 2C9 19 5 15 3 7 2 5 3 3 5 3Z"/>:kind==='location'?<><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>:kind==='instagram'?<><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".7" fill="currentColor"/></>:kind==='facebook'?<path d="M14 21v-8h3l.5-4H14V7c0-1 .5-2 2-2h2V2h-3c-4 0-5 2-5 5v2H7v4h3v8"/>:<><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>}</svg>;
}
export function MenuContact(){
 const {data}=useMenu();const {locale}=useI18n();const ar=locale==='ar';const d=data.payments;
 const phones=contactPhones(data.restaurant.contact_phones??[],data.restaurant.phone);
 const whatsapp=normalizeWhatsapp(d?.payment_whatsapp??'');
 const links=[{kind:'whatsapp',href:/^\d{8,15}$/.test(whatsapp)?`https://wa.me/${whatsapp}`:'',text:'WhatsApp'},{kind:'instagram',href:safeContactUrl(d?.instagram_url),text:'Instagram'},{kind:'location',href:safeContactUrl(d?.location_url),text:ar?'الموقع على الخريطة':'Directions'},{kind:'facebook',href:safeContactUrl(d?.facebook_url),text:'Facebook'},{kind:'website',href:safeContactUrl(d?.website_url),text:ar?'الموقع الإلكتروني':'Website'}].filter(x=>x.href);
 if(!links.length&&!phones.length&&!data.restaurant.address)return null;
 const iconStyle='inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-current/15 bg-white/10';
 return <div className="mx-auto max-w-5xl px-4 py-3">
 {data.restaurant.address&&<div className="mx-auto mb-3 flex max-w-xl items-start justify-center gap-2 text-center text-sm leading-6"><ContactIcon kind="location" className="mt-1 size-5 shrink-0" aria-hidden="true"/><p className="whitespace-pre-line">{data.restaurant.address}</p></div>}
 <nav aria-label={ar?'تواصل مع النشاط':'Contact the business'} className="flex flex-wrap items-center justify-center gap-3">
 {phones.map(phone=><a key={phone} href={`tel:${phone}`} dir="ltr" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-current/15 px-3 text-sm transition-colors hover:bg-current/10 focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={`${ar?'اتصال':'Call'} ${phone}`}><span className={iconStyle}><ContactIcon kind="phone" className="size-4" aria-hidden="true"/></span><bdi>{phone}</bdi></a>)}
 {links.map(x=><a key={x.kind} href={x.href} target="_blank" rel="noopener noreferrer" aria-label={x.text} title={x.text} className={iconStyle}><ContactIcon kind={x.kind} className="size-5" aria-hidden="true"/></a>)}
 </nav>
 </div>;
}
