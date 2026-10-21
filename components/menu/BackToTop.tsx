"use client";
import {useEffect,useState} from 'react';
import {useI18n} from '@/components/i18n/I18nProvider';
import {useMenu} from "./MenuContext";
import {Icon} from '@/components/ui/Icons';
export function BackToTop(){
 const {locale}=useI18n();const {waiterEnabled}=useMenu();const [visible,setVisible]=useState(false);
 useEffect(()=>{let frame=0;const update=()=>{frame=0;setVisible(window.scrollY>Math.max(500,window.innerHeight));};const scroll=()=>{if(!frame)frame=window.requestAnimationFrame(update);};update();window.addEventListener('scroll',scroll,{passive:true});return()=>{window.removeEventListener('scroll',scroll);window.cancelAnimationFrame(frame);};},[]);
 if(!visible)return null;
 return <button type="button" aria-label={locale==='ar'?'العودة لأعلى الصفحة':'Back to top'} title={locale==='ar'?'العودة لأعلى الصفحة':'Back to top'} onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})} className={`${waiterEnabled?"bottom-[calc(10rem+env(safe-area-inset-bottom))]":"bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"} fixed right-4 z-30 inline-flex size-11 items-center justify-center rounded-full border border-white/20 bg-ink-900 text-white shadow-lg transition-colors hover:bg-ink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500`}><Icon.arrowUp className="size-5" aria-hidden="true"/></button>;
}
