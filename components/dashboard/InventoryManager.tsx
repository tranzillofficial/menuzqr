"use client";
import {useActionState,useState} from 'react';
import {saveStock} from '@/lib/actions/inventory';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {useI18n} from '@/components/i18n/I18nProvider';
type StockRow={id:string;name:string;stock_quantity:number;stock_tracked:boolean;products:{name:string;barcode:string|null}};
function StockEditor({row}:{row:StockRow}){
 const [state,action]=useActionState(saveStock,null);const {locale}=useI18n();const ar=locale==='ar';
 return <form action={action} className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-black/5"><input type="hidden" name="variant_id" value={row.id}/><h2 className="font-semibold">{row.products.name}</h2><p className="text-sm text-ink-500">{row.name} · {row.products.barcode}</p><div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm">{ar?'الرصيد الفعلي':'Current stock'}<input name="quantity" type="number" step="0.001" min="-1000000" max="1000000" required defaultValue={row.stock_quantity} className="mt-1 w-full rounded-xl border border-ink-100 px-3 py-2 text-base"/></label><label className="flex items-center gap-2 py-2 text-sm"><input name="tracked" type="checkbox" defaultChecked={row.stock_tracked}/>{ar?'تتبع الرصيد':'Track stock'}</label><SubmitButton>{ar?'حفظ':'Save'}</SubmitButton></div>{state?.message&&<p role="status" className="text-sm">{state.message}</p>}</form>;
}
export function InventoryManager({rows}:{rows:StockRow[]}){
 const [query,setQuery]=useState('');const {locale}=useI18n();const ar=locale==='ar';return <div className="space-y-4"><p className="text-sm text-ink-500">{ar?'رصيد مستقل لكل وحدة بيع. يتم خصم المبيعات المدفوعة وإرجاع رصيد العمليات المستردة تلقائيًا. تعديل الرصيد محفوظ في سجل التعديلات.':'Each selling unit has its own balance. Paid sales reduce tracked stock; refunds restore the original movement. Stock edits are recorded in the audit journal.'}</p><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={ar?'ابحث بالاسم أو الباركود':'Search name or barcode'} className="w-full rounded-xl bg-white p-3 text-base ring-1 ring-black/5"/>{rows.filter(r=>`${r.products.name} ${r.products.barcode??''} ${r.name}`.toLowerCase().includes(query.toLowerCase())).map(row=><StockEditor key={row.id} row={row}/>)}{!rows.length&&<p>{ar?'أضف منتجات أولًا.':'Add products first.'}</p>}</div>;
}
