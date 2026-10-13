"use client";
import {useActionState} from 'react';
import Link from 'next/link';
import {saveStock} from '@/lib/actions/inventory';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {useI18n} from '@/components/i18n/I18nProvider';
type StockRow={id:string;name:string;stock_quantity:number;stock_tracked:boolean;products:{name:string;barcode:string|null}};
function StockEditor({row}:{row:StockRow}){
 const [state,action]=useActionState(saveStock,null);const {locale}=useI18n();const ar=locale==='ar';
 return <form action={action} className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-black/5"><input type="hidden" name="variant_id" value={row.id}/><h2 className="font-semibold">{row.products.name}</h2><p className="text-sm text-ink-500">{row.name} · {row.products.barcode}</p><div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm">{ar?'الرصيد الفعلي':'Current stock'}<input name="quantity" type="number" step="0.001" min="-1000000" max="1000000" required defaultValue={row.stock_quantity} className="mt-1 w-full rounded-xl border border-ink-100 px-3 py-2 text-base"/></label><label className="flex items-center gap-2 py-2 text-sm"><input name="tracked" type="checkbox" defaultChecked={row.stock_tracked}/>{ar?'تتبع الرصيد':'Track stock'}</label><SubmitButton>{ar?'حفظ':'Save'}</SubmitButton></div>{state?.message&&<p role="status" className="text-sm">{state.message}</p>}</form>;
}
export function InventoryManager({rows,query,page,total}:{rows:StockRow[];query:string;page:number;total:number}){
 const {locale}=useI18n();const ar=locale==='ar';
 const href=(value:number)=>`/dashboard/inventory?q=${encodeURIComponent(query)}&page=${value}`;
 return <div className="space-y-4"><p className="text-sm text-ink-500">{ar?'رصيد مستقل لكل وحدة بيع. يتم خصم المبيعات المدفوعة وإرجاع رصيد العمليات المستردة تلقائيًا. تعديل الرصيد محفوظ في سجل التعديلات.':'Each selling unit has its own balance. Paid sales reduce tracked stock; refunds restore the original movement. Stock edits are recorded in the audit journal.'}</p>
 <form action="/dashboard/inventory" className="flex gap-2"><input name="q" defaultValue={query} key={query} aria-label={ar?'ابحث بالاسم أو الباركود':'Search name or barcode'} placeholder={ar?'ابحث بالاسم أو الباركود':'Search name or barcode'} className="min-w-0 flex-1 rounded-xl bg-white p-3 text-base ring-1 ring-black/5"/><button className="rounded-xl bg-brand-600 px-4 text-sm text-white">{ar?'بحث':'Search'}</button></form>
 {rows.map(row=><StockEditor key={row.id} row={row}/>)}
 {!rows.length&&<p>{ar?'لا توجد نتائج.':'No results.'}</p>}
 <nav aria-label={ar?'صفحات المخزون':'Inventory pages'} className="flex items-center justify-between gap-3 text-sm">{page>1?<Link className="rounded-xl bg-white px-4 py-3" href={href(page-1)}>{ar?'السابق':'Previous'}</Link>:<span/>}<span>{page} / {Math.max(1,Math.ceil(total/50))} · {total}</span>{page*50<total?<Link className="rounded-xl bg-white px-4 py-3" href={href(page+1)}>{ar?'التالي':'Next'}</Link>:<span/>}</nav>
 </div>;
}
