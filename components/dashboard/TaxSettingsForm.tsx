"use client";
import {useActionState,useState} from 'react';
import {useI18n} from '@/components/i18n/I18nProvider';
import {saveTaxSettings} from '@/lib/actions/fiscal';
import {TAX_MODES,MARKET,type TaxMode} from '@/lib/tax';
import type {Restaurant} from '@/lib/types';
import {SubmitButton} from '@/components/ui/SubmitButton';
export function TaxSettingsForm({restaurant:r}:{restaurant:Restaurant}) {
 const {locale}=useI18n();const label=(ar:string,en:string)=>locale==='ar'?ar:en;
 const [state,action]=useActionState(saveTaxSettings,null);const [mode,setMode]=useState<TaxMode>(r.tax_mode);
 const field='mt-2 h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm';
 return <form action={action} className="space-y-4 rounded-2xl border border-ink-200 bg-white p-5">
 <h2 className="font-semibold">{label('الضريبة وبيانات الفاتورة','Tax and invoice settings')}</h2>
 <label className="block text-sm">Tax Mode<select name="tax_mode" value={mode} onChange={e=>setMode(e.target.value as TaxMode)} className={field}>{TAX_MODES.map(m=><option value={m} key={m}>{m==='none'?label('بدون وضع ضريبي','No tax mode'):m==='uk'?'UK Tax Mode':m==='uae'?'UAE Tax Mode':'Saudi Tax Mode'}</option>)}</select></label>
 {mode!=='none'&&<p className="text-xs text-ink-500">{MARKET[mode].currency} · {MARKET[mode].timezone} · {label('المعدل الأساسي','Standard rate')} {MARKET[mode].standard}%</p>}
 <label className="block text-sm">VAT Registered<select name="vat_registered" defaultValue={r.vat_registered?'true':'false'} className={field}><option value="false">{label('لا','No')}</option><option value="true">{label('نعم','Yes')}</option></select></label>
 <label className="block text-sm">VAT Number / TRN<input name="vat_number" defaultValue={r.vat_number??''} maxLength={32} className={field}/></label>
 <label className="block text-sm">{label('اسم المنشأة القانوني','Legal business name')}<input name="legal_name" defaultValue={r.legal_name??r.name} maxLength={160} className={field}/></label>
 <label className="block text-sm">{label('عنوان المنشأة للفاتورة','Business invoice address')}<input name="tax_address" defaultValue={r.tax_address??r.address??''} maxLength={400} className={field}/></label>
 <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="prices_include_vat" defaultChecked={r.prices_include_vat}/>{label('الأسعار المدخلة شاملة VAT','Entered prices include VAT')}</label>
 <p className="text-xs text-ink-500">{label('الإعدادات الجديدة تطبّق على الطلبات الجديدة فقط. تغيير الوضع هيضبط العملة والتوقيت للسوق المختار. لو الأسعار قبل الضريبة، العميل بيشوف السعر النهائي شاملها.','New settings apply to new orders only. Changing mode sets the market currency and timezone. VAT exclusive prices are shown to customers with VAT included.')}</p>
 {(mode==='saudi'||mode==='uae')&&<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{mode==='saudi'?label('حساب VAT والسجلات متاحين. الربط بالفوترة الإلكترونية لدى ZATCA غير مفعّل؛ الإيصال الحالي ليس فاتورة إلكترونية معتمدة.','VAT calculation and records are available. ZATCA electronic invoicing is not connected; this receipt is not a compliant electronic invoice.'):label('حساب VAT وبيانات TRN متاحين. الربط بمنظومة الفوترة الإلكترونية الإماراتية غير مفعّل.','VAT calculation and TRN details are available. UAE electronic invoicing is not connected.')}</p>}
 {state?.message&&<p role="status" className={state.ok?'text-sm text-emerald-700':'text-sm text-red-700'}>{state.message}</p>}
 <SubmitButton>{label('حفظ إعدادات الضريبة','Save tax settings')}</SubmitButton></form>;
}
