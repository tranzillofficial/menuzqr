"use client";
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {changeFinancialOrder} from '@/lib/actions/fiscal';
import {Modal} from '@/components/ui/Modal';
import {Button} from '@/components/ui/Button';
import {useI18n} from '@/components/i18n/I18nProvider';
export function FinancialControls({orderId,state,total,legacyVoid=false}:{orderId:string;state:string;total:number;legacyVoid?:boolean}) {
 const {locale}=useI18n();const l=(ar:string,en:string)=>locale==='ar'?ar:en;
 const router=useRouter();const [action,setAction]=useState<'refund'|'void'|'pay'|null>(null),[reason,setReason]=useState(''),[payment,setPayment]=useState<'cash'|'card'|'transfer'>('cash'),[received,setReceived]=useState(String(total)),[error,setError]=useState('');const [busy,start]=useTransition();
 const title=action==='refund'?l('استرداد كامل','Full refund'):action==='void'?l('إلغاء الطلب مع حفظه','Void order'):l('تسجيل الدفع','Record payment');
 return <><div className="flex flex-wrap gap-2">{state==='unpaid'&&<Button size="sm" onClick={()=>setAction('pay')}>{l('تسجيل الدفع','Record payment')}</Button>}{state==='paid'&&<Button size="sm" variant="secondary" onClick={()=>setAction('refund')}>{l('استرداد كامل','Full refund')}</Button>}{(state==='unpaid'||legacyVoid)&&<Button size="sm" variant="ghost" onClick={()=>setAction('void')}>{l('إلغاء الطلب','Void order')}</Button>}</div>
 <Modal open={action!==null} title={title} onClose={()=>{if(!busy){setAction(null);setError('');}}} size="sm"><div className="space-y-4 text-sm">
 <p>{l('العملية بتتحفظ باسمك ووقتها. الفاتورة الأصلية هتفضل موجودة.','Your identity and the time are recorded. The original invoice is retained.')}</p>
 {action==='pay'?<><p className="rounded-lg bg-amber-50 p-3">{l('أكّد الدفع فقط بعد استلامه ومراجعة التحويل بنفسك. لا يوجد تحقق تلقائي من الدفع.','Confirm only after receiving payment and checking the transfer yourself. There is no automatic payment verification.')}</p><select aria-label="Payment method" className="h-11 w-full rounded-xl border px-3" value={payment} onChange={e=>setPayment(e.target.value as 'cash'|'card'|'transfer')}><option value="cash">{l("كاش","Cash")}</option><option value="card">{l("بطاقة","Card")}</option><option value="transfer">{l("تحويل خارجي — تم التحقق يدويًا","External transfer — manually verified")}</option></select>{payment==='cash'&&<label>{l('المبلغ المستلم','Amount received')}<input type="number" step="0.01" min={total} value={received} onChange={e=>setReceived(e.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3"/></label>}</>:<label className="block">{l('سبب العملية','Reason')}<textarea maxLength={400} value={reason} onChange={e=>setReason(e.target.value)} className="mt-2 w-full rounded-xl border p-3"/></label>}
 {error&&<p role="alert" className="text-red-700">{error}</p>}
 <Button loading={busy} disabled={busy||(action!=='pay'&&reason.trim().length<3)||(action==='pay'&&payment==='cash'&&(!received||Number(received)<total))} onClick={()=>start(async()=>{if(!action)return;try{const result=await changeFinancialOrder(orderId,action,reason,payment,Number(received));if(!result.ok){setError(result.message);return;}setAction(null);setReason('');router.refresh();}catch{setError(l('تعذر الاتصال. حاول تاني.','Connection interrupted. Try again.'));}})}>{title}</Button></div></Modal></>;
}
