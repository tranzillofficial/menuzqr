import Link from 'next/link';
import {moduleEnabled,type BusinessConfig} from '@/lib/business-modules';
import {Icon} from '@/components/ui/Icons';
import {cn} from '@/lib/utils';
export function FinanceNavigation({config,active,ar}:{config:BusinessConfig;active:'invoices'|'orders'|'reports';ar:boolean}){
 const tabs=[{id:'invoices' as const,ar:'الفواتير',en:'Invoices',icon:Icon.receipt},{id:'orders' as const,ar:'الطلبات',en:'Orders',icon:Icon.store},{id:'reports' as const,ar:'تقارير المبيعات',en:'Sales reports',icon:Icon.arrowUp}].filter(t=>moduleEnabled(config,t.id));
 return <nav aria-label={ar?'أقسام الفواتير':'Finance sections'} className="flex gap-2 overflow-x-auto rounded-2xl bg-white p-2 ring-1 ring-black/5">{tabs.map(t=><Link key={t.id} href={`/dashboard/${t.id}`} aria-current={active===t.id?'page':undefined} className={cn('flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-xs font-semibold sm:text-sm',active===t.id?'bg-brand-50 text-brand-700 ring-1 ring-brand-200':'text-ink-500 hover:bg-ink-50')}><t.icon className="size-4"/>{ar?t.ar:t.en}</Link>)}</nav>;
}
export function FinanceHeading({ar,description}:{ar:boolean;description:string}){return <header className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon.receipt className="size-5"/></span><div><h1 className="text-xl font-semibold sm:text-2xl">{ar?'الفواتير':'Invoices'}</h1><p className="mt-1 text-xs text-ink-500 sm:text-sm">{description}</p></div></header>}
