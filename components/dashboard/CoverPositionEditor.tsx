"use client";
import {useRef,useState,type PointerEvent} from 'react';
import {MenuCover} from '@/components/menu/MenuCover';
import {useI18n} from '@/components/i18n/I18nProvider';
import {coverDisplay,type CoverDisplay} from '@/lib/menu-cover';

export function CoverPositionEditor({url,initial}:{url:string|null;initial:CoverDisplay}){
 const {locale}=useI18n();const l=(a:string,e:string)=>locale==='ar'?a:e;
 const defaults=coverDisplay(initial);const [fit,setFit]=useState(defaults.fit),[x,setX]=useState(defaults.x),[y,setY]=useState(defaults.y);
 const drag=useRef<{pointer:number;left:number;top:number;x:number;y:number}|null>(null);
 function start(event:PointerEvent<HTMLDivElement>){if(fit!=='cover')return;event.currentTarget.setPointerCapture(event.pointerId);drag.current={pointer:event.pointerId,left:event.clientX,top:event.clientY,x,y};}
 function move(event:PointerEvent<HTMLDivElement>){const d=drag.current;if(!d||d.pointer!==event.pointerId)return;const bounds=event.currentTarget.getBoundingClientRect();setX(Math.min(100,Math.max(0,d.x-(event.clientX-d.left)/bounds.width*100)));setY(Math.min(100,Math.max(0,d.y-(event.clientY-d.top)/bounds.height*100)));}
 return <div className="mt-3 space-y-3">
 <input type="hidden" name="cover_fit" value={fit}/><input type="hidden" name="cover_position_x" value={x}/><input type="hidden" name="cover_position_y" value={y}/>
 <div role="group" aria-label={l('طريقة عرض الخلفية','Cover display mode')} className="flex flex-wrap gap-2">{(['contain','cover'] as const).map(mode=><button key={mode} type="button" aria-pressed={fit===mode} onClick={()=>setFit(mode)} className={`min-h-10 rounded-lg border px-3 text-xs font-medium ${fit===mode?'border-brand-500 bg-brand-50 text-brand-700':'border-ink-200'}`}>{mode==='contain'?l('كاملة مع امتداد ناعم','Full image + soft extension'):l('ملء المساحة وتحديد الجزء الظاهر','Fill & position')}</button>)}</div>
 {url&&<div onPointerDown={start} onPointerMove={move} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} className={`relative select-none overflow-hidden rounded-xl ${fit==='cover'?'touch-none cursor-move':''}`}><MenuCover key={url} restaurant={{cover_url:url,cover_fit:fit,cover_position_x:x,cover_position_y:y}} className="pointer-events-none aspect-[16/7] w-full"/>{fit==='cover'&&<span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/50 p-2 text-center text-[11px] text-white">{l('اسحب لتحريك الصورة أو استخدم أدوات التحكم','Drag to reposition, or use the controls')}</span>}</div>}
 {fit==='cover'&&<div className="grid gap-3 sm:grid-cols-2">{([{axis:'x',label:l('يمين ويسار','Horizontal'),value:x,set:setX},{axis:'y',label:l('أعلى وأسفل','Vertical'),value:y,set:setY}]).map(a=><label key={a.axis} className="text-xs">{a.label}<input type="range" min={0} max={100} value={a.value} onChange={e=>a.set(Number(e.target.value))} className="mt-2 block w-full"/></label>)}</div>}
 <button type="button" onClick={()=>{setFit('contain');setX(50);setY(50)}} className="min-h-10 text-xs text-ink-500">{l('إعادة الضبط','Reset position')}</button>
 <p className="text-[11px] leading-5 text-ink-500">{l('الامتداد الناعم يملأ الفراغ بنسخة مموهة من الصورة مع الحفاظ على الصورة الأصلية كاملة.','Soft extension fills the space with a blurred copy while keeping the original fully visible.')}</p>
 </div>;
}
