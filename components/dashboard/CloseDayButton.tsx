"use client";
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {closeDay} from '@/lib/actions/fiscal';
import {Modal} from '@/components/ui/Modal';
import {Button} from '@/components/ui/Button';
import {useI18n} from '@/components/i18n/I18nProvider';
export function CloseDayButton(){const {locale}=useI18n();const l=(a:string,e:string)=>locale==='ar'?a:e;const router=useRouter();const [open,setOpen]=useState(false),[message,setMessage]=useState('');const [busy,start]=useTransition();return <><Button onClick={()=>setOpen(true)}>{l('إغلاق اليوم وحفظ Z Report','Close day and save Z report')}</Button><Modal open={open} onClose={()=>{if(!busy)setOpen(false);}} title={l('إغلاق اليوم','Close day')} size="sm"><p className="mb-4 text-sm">{l('التقرير هيحفظ العمليات من آخر إغلاق حتى اللحظة دي. العمليات اللي تحصل بعده تدخل التقرير التالي. التقرير المحفوظ لا يتعدل، وتقدر تعمل إغلاق واحد كل يوم.','The report saves events since the previous close through now. Later events enter the next report. Saved reports are immutable, with one close per calendar day.')}</p><Button loading={busy} disabled={busy} onClick={()=>start(async()=>{try{const result=await closeDay();setMessage(result.message);if(result.ok){setOpen(false);router.refresh();}}catch{setMessage('Connection interrupted. Try again.');}})}>{l('تأكيد الإغلاق','Confirm close')}</Button></Modal>{message&&<p role="status" className="text-sm">{message}</p>}</>;}
