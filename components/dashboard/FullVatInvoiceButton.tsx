"use client";
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Modal} from '@/components/ui/Modal';
import {Button} from '@/components/ui/Button';
import {useI18n} from '@/components/i18n/I18nProvider';
import {issueFullVatInvoice} from '@/lib/actions/fiscal';
export function FullVatInvoiceButton({orderId}:{orderId:string}){
 const {locale}=useI18n();const l=(a:string,e:string)=>locale==='ar'?a:e;const router=useRouter();const [open,setOpen]=useState(false),[name,setName]=useState(''),[address,setAddress]=useState(''),[vat,setVat]=useState(''),[error,setError]=useState('');const [busy,start]=useTransition();
 return <><Button variant="secondary" onClick={()=>setOpen(true)}>{l('إصدار فاتورة ضريبية كاملة','Issue full VAT invoice')}</Button><Modal open={open} onClose={()=>{if(!busy)setOpen(false);}} title={l('بيانات العميل للفاتورة','Invoice customer details')} size="sm"><div className="space-y-3"><p className="text-xs text-ink-500">{l('الفاتورة بتستخدم بيانات الضريبة والمنشأة المحفوظة وقت البيع. بيانات العميل بتتحفظ ومش بتتعدل بعد الإصدار.','Uses the tax and business details saved at sale. Customer details are saved permanently when issued.')}</p>{[[l('اسم العميل','Customer name'),name,setName],[l('عنوان العميل','Customer address'),address,setAddress],[l('رقم ضريبة العميل إن وجد','Customer VAT number, if registered'),vat,setVat]].map(([label,value,set])=><label key={label as string} className="block text-sm">{label as string}<input value={value as string} onChange={e=>(set as (s:string)=>void)(e.target.value)} maxLength={400} className="mt-2 h-11 w-full rounded-xl border px-3"/></label>)}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}<Button loading={busy} disabled={busy||name.trim().length<2||address.trim().length<5} onClick={()=>start(async()=>{try{const result=await issueFullVatInvoice(orderId,{name,address,vat_number:vat});if(!result.ok){setError(result.message);return;}setOpen(false);router.refresh();}catch{setError('Connection interrupted. Try again.');}})}>{l('إصدار وحفظ','Issue and save')}</Button></div></Modal></>;
}
