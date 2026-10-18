'use client';

import { useRef } from 'react';
import { MENU_THEMES } from '@/lib/constants';
import type { MenuData } from '@/lib/types';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { MenuProvider } from './MenuContext';
import { MenuContact } from './MenuContact';
import { ProductSheet } from './ProductSheet';
import { ElegantMenu } from './themes/ElegantMenu';
import { DemoMenu } from './themes/DemoMenu';
import { MinimalMenu } from './themes/MinimalMenu';
import { NoirMenu } from './themes/NoirMenu';
import { MarketMenu } from './themes/MarketMenu';

const templates = { elegant: ElegantMenu, modern: DemoMenu, minimal: MinimalMenu, noir: NoirMenu, market: MarketMenu };
const names = { belmir: 'بلمير الأصلي', elegant: 'أنيق', modern: 'عصري', minimal: 'بسيط', noir: 'نوار', market: 'ماركت' };
const choices = [{ id: 'belmir', swatch: ['#402d2e', '#89876b', '#eee7d8'] }, ...MENU_THEMES] as const;

export function BelmirNativeMenu({ data }: { data: MenuData }) {
  const picker = useRef<HTMLDetailsElement>(null);
  const theme = data.restaurant.menu_theme;
  const Template = templates[theme];
  return <I18nProvider locale="en"><div dir="ltr" lang="en">
    <nav aria-label="Menu design preview" className="flex items-center gap-3 border-b border-ink-200 bg-white px-3 py-2 text-ink-900">
      <details ref={picker} className="relative" onKeyDown={event => { if (event.key === 'Escape' && picker.current) { picker.current.open = false; picker.current.querySelector('summary')?.focus(); } }}>
        <summary lang="ar" className="cursor-pointer rounded-full border border-ink-200 inline-flex min-h-10 items-center whitespace-nowrap px-3 py-1.5 text-xs font-semibold">غيّر التصميم</summary>
        <div className="absolute start-0 top-full z-50 mt-2 w-56 rounded-2xl border border-ink-200 bg-white p-2 shadow-xl">
          {choices.map(choice => <a key={choice.id} href={`/belmir/menu?design=${choice.id}`} aria-current={theme === choice.id ? 'page' : undefined} className={`flex items-center gap-2 rounded-xl px-3 py-3 text-sm ${theme === choice.id ? 'bg-ink-900 text-white' : 'hover:bg-ink-50'}`}>
            <span aria-hidden="true" className="flex gap-0.5">{choice.swatch.map(color => <span key={color} className="size-3 rounded-full ring-1 ring-black/10" style={{ backgroundColor: color }} />)}</span>
            <span lang="ar">{names[choice.id]}</span>{theme === choice.id && <span className="ms-auto" aria-hidden="true">✓</span>}
          </a>)}
        </div>
      </details>
      <a href="/belmir" className="ms-auto text-xs" aria-label="Belmir home">← Home</a>
    </nav>
    <MenuProvider data={data} table={null} showPrices showIngredients>
      {theme === 'modern' ? <DemoMenu showMarketing={false} /> : <Template />}
      <MenuContact /><ProductSheet />
    </MenuProvider>
  </div></I18nProvider>;
}
