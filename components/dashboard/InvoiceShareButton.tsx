"use client";
import {useState} from 'react';
import {useI18n} from '@/components/i18n/I18nProvider';
import {formatMoney} from '@/lib/utils';
import {Icon} from '@/components/ui/Icons';
import type {PosReceipt} from '@/lib/thermal-print';
export function InvoiceShareButton({receipt,name}:{receipt:PosReceipt;name:string}){
 const {locale}=useI18n(),ar=locale==='ar',[message,setMessage]=useState('');
 async function share(){const sign=receipt.creditNote?-1:1;const text=[name,`${ar?'الفاتورة':'Invoice'} #${receipt.number}`,...receipt.lines.map(l=>`${l.quantity} × ${l.name}: ${formatMoney(sign*(l.gross??l.price*l.quantity),receipt.currency??'EGP')}`),`${ar?'الإجمالي':'Total'}: ${formatMoney(sign*receipt.total,receipt.currency??'EGP')}`].join('\n');try{if(navigator.share)await navigator.share({title:`${name} #${receipt.number}`,text});else{await navigator.clipboard.writeText(text);setMessage(ar?'تم نسخ ملخص الفاتورة.':'Invoice summary copied.');}}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setMessage(ar?'تعذر المشاركة. حاول مرة أخرى.':'Could not share. Try again.');}}
 return <div><button type="button" onClick={share} className="flex items-center gap-2 rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-xs"><Icon.external className="size-4"/>{ar?'مشاركة الملخص':'Share summary'}</button>{message&&<p role="status" className="mt-2 text-[11px] text-ink-500">{message}</p>}</div>;
}
