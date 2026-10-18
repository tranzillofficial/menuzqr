'use client';

import { useMenu } from './MenuContext';
const paths = {
  TikTok: <path d="M16 2c.4 2.8 2 4.5 5 4.8v4a10 10 0 0 1-5-1.5V17a6 6 0 1 1-6-6h1v4h-1a2 2 0 1 0 2 2V2h4Z" />,
  WhatsApp: <><path d="M20.5 11.7a8.5 8.5 0 0 1-12.5 7.5L3 21l1.6-5A8.5 8.5 0 1 1 20.5 11.7Z"/><path d="M8 7.5c0 4 4 8 8 8l1-2.2-2.8-1.4-1.2 1.2-2.7-2.7 1.2-1.2L10 6.5 8 7.5Z"/></>,
  Instagram: <><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".7" fill="currentColor"/></>,
  Facebook: <path d="M14 21v-8h3l.5-4H14V7c0-1.5.5-2 2-2h2V2h-3c-3 0-5 2-5 5v2H7v4h3v8"/>,
};

export function BelmirSocialLinks() {
  const {data}=useMenu();const p=data.payments;
  const links=[{name:'TikTok',url:p?.tiktok_url},{name:'WhatsApp',url:p?.payment_whatsapp?`https://wa.me/${p.payment_whatsapp}`:''},{name:'Instagram',url:p?.instagram_url},{name:'Facebook',url:p?.facebook_url}] as const;
  return <footer className="bg-[#faf7f2] px-4 py-6"><nav aria-label="Belmir social media" className="flex items-center justify-center gap-3">
    {links.map(link=>link.url?<a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.name} title={link.name} className="grid size-11 place-items-center rounded-full border border-[#e8ded3] bg-white text-[#402d2e] transition hover:bg-[#eee7d8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#402d2e]"><svg viewBox="0 0 24 24" className="size-5" fill={link.name==='TikTok'?'currentColor':'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[link.name]}</svg></a>:<span key={link.name} title={`${link.name} link not added yet`} aria-label={`${link.name} link not added yet`} className="grid size-11 place-items-center rounded-full border border-[#e8ded3] text-[#402d2e]/30"><svg viewBox="0 0 24 24" className="size-5" fill={link.name==='TikTok'?'currentColor':'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[link.name]}</svg></span>)}
  </nav></footer>;
}
