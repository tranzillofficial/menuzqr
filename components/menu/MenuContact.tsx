"use client";
import {useMenu} from './MenuContext';
import {useI18n} from '@/components/i18n/I18nProvider';
export function MenuContact(){
 const {data}=useMenu();const {locale}=useI18n();const ar=locale==='ar';const d=data.payments;
 const links=[{href:data.restaurant.phone?`tel:${data.restaurant.phone}`:'',text:ar?'اتصال':'Call'},{href:d?.payment_whatsapp?`https://wa.me/${d.payment_whatsapp}`:'',text:'WhatsApp'},{href:d?.location_url,text:ar?'الموقع على الخريطة':'Directions'},{href:d?.facebook_url,text:'Facebook'},{href:d?.instagram_url,text:'Instagram'},{href:d?.website_url,text:ar?'الموقع الإلكتروني':'Website'}].filter(x=>x.href);
 if(!links.length)return null;
 return <nav aria-label={ar?'تواصل مع النشاط':'Contact the business'} className="mx-auto flex max-w-5xl flex-wrap justify-center gap-2 px-4 py-5">{links.map(x=><a key={x.text} href={x.href} target={x.href?.startsWith('tel:')?undefined:'_blank'} rel="noreferrer" className="rounded-full bg-white px-4 py-2.5 text-sm font-medium text-ink-700 shadow-sm ring-1 ring-black/5">{x.text}</a>)}</nav>;
}
