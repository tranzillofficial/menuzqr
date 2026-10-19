"use client";
import {useMenu} from './MenuContext';
import {useI18n} from '@/components/i18n/I18nProvider';
import {Icon} from '@/components/ui/Icons';

function safeLink(value?:string){
 if(!value?.trim())return '';
 try{const url=new URL(value.trim());return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
export function MenuContact(){
 const {data}=useMenu();const {locale}=useI18n();const ar=locale==='ar';const d=data.payments;
 const links=[
  {href:safeLink(d?.whatsapp_url),text:'WhatsApp',icon:Icon.whatsapp,color:'text-emerald-700'},
  {href:safeLink(d?.facebook_url),text:'Facebook',icon:Icon.facebook,color:'text-blue-700'},
  {href:safeLink(d?.instagram_url),text:'Instagram',icon:Icon.instagram,color:'text-pink-700'},
  {href:safeLink(d?.tiktok_url),text:'TikTok',icon:Icon.tiktok,color:'text-ink-900'},
  {href:safeLink(d?.website_url),text:ar?'الموقع الإلكتروني':'Website',icon:Icon.globe,color:'text-ink-700'},
  {href:safeLink(d?.location_url),text:ar?'الموقع على الخريطة':'Directions',icon:Icon.pin,color:'text-ink-700'},
  {href:data.restaurant.phone?`tel:${data.restaurant.phone.replace(/[^+0-9]/g,'')}`:'',text:ar?'اتصال':'Call',icon:Icon.phone,color:'text-ink-700'},
 ].filter(x=>x.href);
 if(!links.length)return null;
 return <nav aria-label={ar?'تواصل مع النشاط':'Contact the business'} className="mx-auto flex max-w-5xl flex-wrap justify-center gap-2 px-4 py-4">{links.map(x=><a key={x.text} href={x.href} aria-label={x.text} title={x.text} target={x.href.startsWith('tel:')?undefined:'_blank'} rel="noopener noreferrer" className={`grid size-11 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${x.color}`}><x.icon aria-hidden="true" className="size-5"/></a>)}</nav>;
}
