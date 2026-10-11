"use client";
import {useEffect, useRef, useState} from 'react';
import {lookupPosBarcode} from '@/lib/actions/barcode';
import {normalizeBarcode,validBarcode} from '@/lib/barcode';
import {useI18n} from '@/components/i18n/I18nProvider';
import {Modal} from '@/components/ui/Modal';
import {Button} from '@/components/ui/Button';
import type {ProductWithVariants,ProductVariant} from '@/lib/types';

export function PosBarcode({disabled,onAdd,onBusyChange}:{disabled:boolean;onAdd:(product:ProductWithVariants,variant:ProductVariant)=>void;onBusyChange:(busy:boolean)=>void}) {
  const {locale}=useI18n();const l=(ar:string,en:string)=>locale==='ar'?ar:en;
  const [code,setCode]=useState(''); const [manual,setManual]=useState(false);
  const [message,setMessage]=useState('');const [error,setError]=useState(false);
  const [choice,setChoice]=useState<ProductWithVariants|null>(null);
  const choose=useRef<((variant:ProductVariant|null)=>void)|null>(null);
  const queue=useRef(Promise.resolve());const outstanding=useRef(0);
  const mounted=useRef(true);const scan=useRef({value:'',time:0});
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;choose.current?.(null);};},[]);

  function enqueue(raw:string) {
    if(disabled)return;
    const barcode=normalizeBarcode(raw);
    if(!validBarcode(barcode)){setError(true);setMessage(l('اكتب باركود صحيحًا.','Enter a valid barcode.'));return;}
    setCode('');setManual(false);outstanding.current++;onBusyChange(true);
    // Process all scans in order, including two scans of the same product.
    queue.current=queue.current.then(async()=>{
      if(!mounted.current)return;
      setError(false);setMessage(l('جاري البحث…','Looking up barcode…'));
      const result=await lookupPosBarcode(barcode);
      if(!mounted.current)return;
      if(!result.ok){setError(true);setMessage(result.message);return;}
      const product=result.product;
      const variants=product.product_variants.filter(v=>v.is_active&&Number.isFinite(Number(v.price))).sort((a,b)=>a.sort_order-b.sort_order);
      if(!variants.length){setError(true);setMessage(l('المنتج ليس له سعر بيع مفعّل.','No active price for this product.'));return;}
      let variant:ProductVariant|null=variants[0];
      if(variants.length>1){setChoice({...product,product_variants:variants});variant=await new Promise<ProductVariant|null>(resolve=>{choose.current=resolve;});}
      if(variant&&mounted.current){onAdd(product,variant);setError(false);setMessage(`${l('تمت قراءة','Scanned')}: ${product.name}`);}
    }).catch(()=>{if(mounted.current){setError(true);setMessage(l('تعذر الاتصال. أعد قراءة الباركود.','Connection failed. Scan again.'));}}).finally(()=>{
      outstanding.current--;if(mounted.current&&outstanding.current===0)onBusyChange(false);
    });
  }
  function finishChoice(variant:ProductVariant|null){setChoice(null);choose.current?.(variant);choose.current=null;}
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      const target=event.target;
      // Never steal typing/scans from price, payment, notes or a dialog.
      if(disabled||event.isComposing||event.ctrlKey||event.altKey||event.metaKey||document.querySelector('[role="dialog"]')||(target instanceof Element&&target.closest('input,textarea,select,[contenteditable="true"]'))){scan.current.value='';return;}
      const now=performance.now();if(now-scan.current.time>100)scan.current.value='';scan.current.time=now;
      if(event.key==='Enter'){
        const value=scan.current.value;scan.current.value='';
        if(value.length>=4){event.preventDefault();event.stopPropagation();enqueue(value);}
      }else if(event.key.length===1&&!event.repeat){scan.current.value=(scan.current.value+event.key).slice(-129);}
      else if(event.key!=='Shift')scan.current.value='';
    };
    window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);
  });
  const form=(id:string)=><form onSubmit={event=>{event.preventDefault();enqueue(code);}} className="flex flex-wrap gap-2">
    <label htmlFor={id} className="sr-only">{l('الباركود','Barcode')}</label>
    <input id={id} dir="ltr" type="text" autoComplete="off" maxLength={128} disabled={disabled} value={code} onChange={event=>setCode(event.target.value)} placeholder={l('امسح الباركود ثم Enter','Scan barcode, then Enter')} className="h-11 min-w-0 flex-1 rounded-xl border border-ink-200 bg-white px-3 text-sm"/>
    <Button type="submit" disabled={disabled||!code.trim()}>{l('إضافة بالباركود','Add by barcode')}</Button>
  </form>;
  return <div className="space-y-2 rounded-xl border border-ink-200 bg-white p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{l('قارئ الباركود','Barcode scanner')}</span><Button type="button" variant="secondary" disabled={disabled} onClick={()=>setManual(true)}>{l('كتابة الباركود','Enter barcode manually')}</Button></div>
    {form('pos-barcode')}
    <p className="text-xs text-ink-500">{l('قارئ USB أو بلوتوث بوضع لوحة المفاتيح مع Enter. كل قراءة تزيد الكمية. لو بتكتب في خانة أخرى، اضغط خانة الباركود أولًا.','Use a USB/Bluetooth keyboard-mode scanner with an Enter suffix. Each scan adds one. If editing another field, focus the barcode field first.')}</p>
    {message&&<p role={error?'alert':'status'} className={error?'text-sm text-red-700':'text-sm text-emerald-700'}>{message}</p>}
    <Modal open={manual} onClose={()=>setManual(false)} title={l('كتابة الباركود','Enter barcode manually')} size="sm">{form('manual-barcode')}</Modal>
    <Modal open={!!choice} onClose={()=>finishChoice(null)} title={l('اختار وحدة البيع','Choose sale unit')} size="sm"><p className="mb-3 font-semibold">{choice?.name}</p><div className="space-y-2">{choice?.product_variants.map(v=><Button key={v.id} type="button" variant="secondary" onClick={()=>finishChoice(v)}>{v.name} · {Number(v.price).toFixed(2)}</Button>)}</div></Modal>
  </div>;
}
