'use client';
import { CATALOG_ACTIVITIES } from '@/lib/catalog-activities';
import { useI18n } from '@/components/i18n/I18nProvider';

export function CatalogActivityFilter({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  const {locale}=useI18n();
  return <div className="space-y-2">
    <p className="text-xs font-semibold text-ink-500">{locale==='ar'?'حسب نوع النشاط':'Business type'}</p>
    <div className="flex flex-wrap gap-2" role="group" aria-label={locale==='ar'?'نوع النشاط':'Business type'}>
      {[{id:'all',ar:'كل الأنشطة',en:'All businesses'},...CATALOG_ACTIVITIES].map(activity=><button key={activity.id} type="button" aria-pressed={value===activity.id} onClick={()=>onChange(activity.id)} className={`min-h-10 rounded-xl border px-4 text-sm font-medium ${value===activity.id?'border-brand-600 bg-brand-600 text-white':'border-ink-200 bg-white text-ink-600 hover:border-brand-300'}`}>{locale==='ar'?activity.ar:activity.en}</button>)}
    </div>
  </div>;
}
