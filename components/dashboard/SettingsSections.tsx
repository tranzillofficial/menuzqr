"use client";
import {useState,type ReactNode} from 'react';
import {useI18n} from '@/components/i18n/I18nProvider';
export function SettingsSections({sections}:{sections:{id:string;ar:string;en:string;content:ReactNode}[]}){
 const [active,setActive]=useState(sections[0]?.id);const {locale}=useI18n();
 return <div className="space-y-5"><div role="tablist" aria-label={locale==='ar'?'أقسام الإعدادات':'Settings sections'} className="flex flex-wrap gap-2 rounded-2xl border bg-white p-3">{sections.map(s=><button key={s.id} id={`tab-${s.id}`} type="button" role="tab" aria-selected={active===s.id} aria-controls={`panel-${s.id}`} onClick={()=>setActive(s.id)} className={`min-h-11 rounded-xl px-4 text-sm font-medium ${active===s.id?'bg-ink-900 text-white':'text-ink-600 hover:bg-ink-50'}`}>{s[locale==='ar'?'ar':'en']}</button>)}</div>{sections.map(s=><section key={s.id} id={`panel-${s.id}`} role="tabpanel" aria-labelledby={`tab-${s.id}`} hidden={active!==s.id} className="space-y-5">{s.content}</section>)}</div>;
}
