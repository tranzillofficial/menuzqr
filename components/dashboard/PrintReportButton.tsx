"use client";
import {useI18n} from '@/components/i18n/I18nProvider';
export function PrintReportButton(){const {locale}=useI18n();return <button className="rounded-xl border bg-white px-4 py-2 text-sm" onClick={()=>window.print()}>{locale==='ar'?'طباعة التقرير أو حفظ PDF':'Print report or save PDF'}</button>;}
