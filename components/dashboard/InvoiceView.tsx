"use client";
import {recordReceiptPrint} from "@/lib/actions/fiscal";
import {useI18n} from '@/components/i18n/I18nProvider';
import {ThermalPrinter} from './ThermalPrinter';
import {formatMoney} from '@/lib/utils';
import type {PosReceipt} from '@/lib/thermal-print';
export function InvoiceView({receipt,restaurantId,fallbackName}:{receipt:PosReceipt;restaurantId:string;fallbackName:string}){
 const {locale}=useI18n();const l=(a:string,e:string)=>locale==='ar'?a:e;const f=receipt.fiscal;const currency=receipt.currency??'GBP';const money=(v:number)=>formatMoney(v,currency);const sign=receipt.creditNote?-1:1;
 const title=receipt.creditNote?l('إشعار دائن','Credit note'):f?.invoice_kind==='full'||f?.invoice_kind==='simplified'?l('فاتورة ضريبية','VAT invoice'):l('إيصال بيع','Sales receipt');
 return <div className="space-y-4"><ThermalPrinter restaurantId={restaurantId} restaurantName={f?.legal_name??fallbackName} currency={currency} receipt={receipt}/><button onClick={async()=>{if(receipt.orderId)await recordReceiptPrint(receipt.orderId,receipt.creditNote?'credit':'invoice','browser');window.print();}} className="rounded-xl border bg-white px-4 py-2 text-sm">{l('طباعة أو حفظ PDF','Print or save PDF')}</button>
 <article id="pos-receipt" className="rounded-2xl border bg-white p-5"><h1 className="text-xl font-semibold">{f?.legal_name??fallbackName}</h1><p>{f?.address}</p>{f?.registered&&<p>VAT / TRN: {f.vat_number}</p>}<h2 className="mt-4 font-semibold">{title} {receipt.creditNote?`CN-${receipt.number}`:receipt.documentNumber??`#${receipt.number}`}</h2>{receipt.creditNote&&<p>{l('مرجع الفاتورة الأصلية','Original invoice reference')}: {receipt.originalDocumentNumber??`#${receipt.number}`}</p>}
 <p className="text-sm">{l('تاريخ الإصدار','Issue date')}: {new Date(receipt.creditNote?receipt.creditDate??receipt.createdAt:receipt.createdAt).toLocaleString(locale==='ar'?'ar-EG':'en-GB',{timeZone:f?.timezone??'UTC'})}</p><p className="text-sm">{l('تاريخ التوريد / الدفع','Supply / payment date')}: {new Date(receipt.paidAt??receipt.createdAt).toLocaleString(locale==='ar'?'ar-EG':'en-GB',{timeZone:f?.timezone??'UTC'})}</p>
 {f?.customer?.name&&<p className="mt-2">{l('العميل','Customer')}: {f.customer.name} · {f.customer.address} {f.customer.vat_number&&`VAT / TRN: ${f.customer.vat_number}`}</p>}
 <ul className="my-5 space-y-3">{receipt.lines.map((line,i)=><li key={i} className="border-t pt-2"><p>{line.name} · {line.variant}</p><p className="text-sm">{line.quantity} × {money(f ? (line.net??0)/line.quantity : line.price)} {f&&l('قبل VAT','excluding VAT')} · {money(sign*(line.gross??line.price*line.quantity))}</p>{f?.registered&&<p className="text-xs text-ink-500">{line.code} {line.code==='exempt'?'':`${line.rate}%`} · VAT {money(sign*(line.vat??0))}</p>}</li>)}</ul>
 <p>{l('قبل الضريبة','Subtotal')}: {f ? money(sign*f.net) : "?"}</p><p>VAT: {f ? money(sign*f.vat) : "?"}</p><p className="text-lg font-semibold">{l('الإجمالي','Total')}: {money(sign*receipt.total)}</p>
 {f?.breakdown.map(b=><p key={`${b.code}-${b.rate}`} className="mt-2 text-xs">{b.code} {b.rate}% · {l('قبل الضريبة','Net')} {money(sign*b.net)} · VAT {money(sign*b.vat)} · {money(sign*b.gross)}</p>)}
 <p className="mt-4 text-sm">{receipt.fiscalState==='unpaid'?l('غير مدفوع','Unpaid'):receipt.payment==='transfer'?l('تحويل خارجي — تأكيد يدوي','External transfer — manually confirmed'):receipt.payment} {receipt.creditNote&&l('استرداد','Refund')}</p>{receipt.note&&<p>{receipt.note}</p>}
 {f?.invoice_kind==='receipt'&&f.registered&&<p className="mt-3 text-xs">{f.mode==='saudi'?l('إيصال بيع. الربط بالفوترة الإلكترونية ZATCA غير مفعّل.','Sales receipt. ZATCA electronic invoicing is not connected.'):l('إيصال بيع، وليس فاتورة ضريبية كاملة.','Sales receipt, not a full VAT invoice.')}</p>}
 {!f&&<p className="mt-3 text-xs">{l('طلب تاريخي. بيانات VAT وقت البيع غير مسجلة.','Historical order. VAT at the time of sale was not recorded.')}</p>}</article></div>;
}
