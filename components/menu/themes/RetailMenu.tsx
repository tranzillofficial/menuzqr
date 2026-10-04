"use client";

import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';
import { DemoProductArt } from '../DemoProductArt';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useMenu } from '../MenuContext';
import { MenuImage } from '../MenuMedia';
import { categoryAncestors, categoryDescendants, categoryPath } from '@/lib/category-tree';
import { useI18n } from '@/components/i18n/I18nProvider';
import { priceRange } from '@/lib/utils';
import type { ProductWithVariants } from '@/lib/types';

export function RetailMenu() {
  const { data, currency, showPrices, openProduct, orderingEnabled } = useMenu();
  const { locale } = useI18n();
  const ar = locale === 'ar';
  const router = useRouter();
  const pathname = data.menu_path ?? `/${data.restaurant.slug}/menu`;
  const search = useSearchParams();
  const [query, setQuery] = useState('');
  const [filtersOpen,setFiltersOpen]=useState(false);
  const { restaurant, categories } = data;
  const alhamd=restaurant.slug==='alhamd';
  const roots=categories.filter(c=>!c.parent_id);
  const selected = categories.find(c => c.id === search.get('category'))?.id ?? null;
  const grouped = search.get('view') === 'groups';
  const trail = selected ? categoryAncestors(categories, selected) : [];
  const descendants = selected ? categoryDescendants(categories, selected) : null;
  const needle = query.trim().toLocaleLowerCase();
  const groups = categories
    .filter(c => !descendants || descendants.has(c.id))
    .map(c => {
      const path = categoryPath(categories, c.id);
      return { category: c, path, products: c.products.filter(p =>
        !needle || `${p.name} ${p.description ?? ''} ${path}`.toLocaleLowerCase().includes(needle)
      ) };
    }).filter(g => g.products.length > 0);
  const products = groups.flatMap(g => g.products.map(product => ({ product, path: g.path })));

  function href(category: string | null, view = grouped) {
    // Keep table QR parameters and all other menu context when changing filters.
    const params = new URLSearchParams(search.toString());
    if (category) params.set('category', category); else params.delete('category');
    if (view) params.set('view', 'groups'); else params.delete('view');
    return `${pathname}${params.size ? `?${params}` : ''}`;
  }
  function go(category: string | null, view = grouped) {
    router.push(href(category, view), { scroll: false });
  }
  function productCard(p: ProductWithVariants, path: string) {
    const demo=p.name.includes('(تجريبي)');
    return <button key={p.id} type="button" onClick={() => openProduct(p)} className={`group flex h-full flex-col overflow-hidden rounded-[22px] border bg-white text-start transition active:scale-[.98] ${alhamd?'border-[#ecdfd2] shadow-[0_3px_14px_#56351f08] hover:border-[#bc9567]':'border-ink-200 hover:border-brand-400'}`}>
      <div className="relative w-full">{!p.image_url&&demo?<DemoProductArt name={p.name} className="aspect-[6/5] w-full"/>:<MenuImage src={p.image_url} alt={p.name} className="aspect-[6/5] w-full" sizes="(max-width:640px) 50vw, 240px"/>}{demo&&<span className="absolute start-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold text-[#805637]">{ar?'للتجربة':'Demo'}</span>}</div>
      <div className="flex w-full flex-1 flex-col p-3 sm:p-4"><p className="mb-1 truncate text-[10px] text-ink-500">{path}</p><p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 sm:text-base">{p.name.replace(' (تجريبي)','')}</p>
        <div className="mt-3 flex items-end justify-between gap-1">{showPrices&&<p className={`text-sm font-bold sm:text-base ${alhamd?'text-[#704728]':'text-brand-700'}`}>{priceRange(p.product_variants.map(v=>Number(v.price)),currency)}</p>}<span className={`ms-auto grid size-9 shrink-0 place-items-center rounded-full ${alhamd?'bg-[#f3e8da] text-[#704728]':'bg-brand-50 text-brand-700'}`} aria-label={orderingEnabled?(ar?'اختيار للطلب':'Choose to order'):(ar?'التفاصيل':'Details')}><Icon.plus className="size-4"/></span></div>
      </div>
    </button>;
  }
  const grid = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4';
  const levels = [null, ...trail.map(c => c.id)];

  return <div className={`min-h-screen pb-28 ${alhamd?"bg-[#faf7f2] text-[#39281e]":"bg-ink-50"}`}>
    {restaurant.cover_url && <MenuImage src={restaurant.cover_url} alt={ar?"صورة غلاف الشركة":"Business cover"} priority fit="cover" sizes="100vw" className="h-48 w-full sm:h-72"/>}
    <header className={alhamd?'relative overflow-hidden border-b border-[#ecdfd2] bg-gradient-to-br from-[#fffaf2] via-[#f6ebd9] to-[#e8d4b7] px-5 pb-7 pt-6 sm:py-10':'border-b border-ink-100 bg-white px-5 py-8'}>
      <div className="mx-auto flex max-w-5xl items-center gap-4">{restaurant.logo_url&&<MenuImage priority src={restaurant.logo_url} alt={restaurant.name} className="size-20 shrink-0 rounded-2xl bg-white shadow-sm sm:size-24" sizes="96px"/>}<div className="min-w-0"><p className="mb-1 text-[10px] font-semibold uppercase tracking-[.15em] text-[#8a6746]">{ar?'كتالوج المنتجات':'PRODUCT COLLECTION'}</p><h1 className="text-2xl font-bold sm:text-3xl">{restaurant.name}</h1><p className="mt-2 max-w-md text-xs leading-6 text-ink-600 sm:text-sm">{restaurant.description||(ar?'كل أصنافك في مكان واحد. اختار، تصفّح، واطلب بسهولة.':'Your collection in one place. Browse, choose and order easily.')}</p></div></div>
      {(restaurant.address||restaurant.phone)&&<div className="mx-auto mt-4 flex max-w-5xl flex-wrap items-center gap-3 text-xs text-ink-600">{restaurant.address&&<p>{restaurant.address}</p>}{restaurant.phone&&<a className="rounded-full bg-white/75 px-3 py-2" href={`tel:${restaurant.phone}`}>{ar?'تواصل مع الفرع':'Contact the branch'} · {restaurant.phone}</a>}</div>}
    </header>
    <main className="mx-auto max-w-5xl space-y-4 px-3 py-4 sm:p-6">
      <section aria-label={ar ? 'البحث وتصفية الأصناف' : 'Search and filter products'} className="space-y-3 rounded-2xl border border-ink-200/60 bg-white p-3 sm:p-4">
        <div className="flex gap-2"><label className="relative min-w-0 flex-1"><span className="sr-only">{ar?'ابحث عن صنف أو شركة':'Search products or companies'}</span><Icon.search className="pointer-events-none absolute start-3 top-3.5 size-5 text-ink-400"/><input type="search" placeholder={ar?'بتدور على إيه؟ صنف أو شركة…':'Search products or companies…'} className="h-12 w-full rounded-xl border border-ink-200 bg-ink-50/70 ps-10 pe-3 text-sm outline-none focus:border-[#bc9567]" value={query} onChange={e=>setQuery(e.target.value)}/></label><button type="button" aria-expanded={filtersOpen} aria-controls="retail-filters" onClick={()=>setFiltersOpen(!filtersOpen)} className="flex h-12 items-center gap-2 rounded-xl bg-[#704728] px-3 text-xs font-semibold text-white"><Icon.settings className="size-4"/>{ar?'فلترة':'Filters'}</button></div>
        <div className="flex gap-2 overflow-x-auto pb-1"><Link href={href(null)} scroll={false} prefetch={false} className={`flex min-h-10 shrink-0 items-center rounded-full px-4 text-xs font-semibold ${!selected?'bg-[#704728] text-white':'bg-[#f7f2eb] text-[#704728]'}`}>{ar?'كل الأصناف':'All products'}</Link>{roots.map(c=><Link key={c.id} href={href(c.id)} scroll={false} prefetch={false} className={`flex min-h-10 shrink-0 items-center rounded-full px-4 text-xs font-semibold ${trail[0]?.id===c.id?'bg-[#704728] text-white':'bg-[#f7f2eb] text-[#704728]'}`}>{c.name}</Link>)}</div>
        <div id="retail-filters" className={`${filtersOpen?"grid":"hidden"} gap-3 sm:grid-cols-2 lg:grid-cols-3`}>
          <label className="block text-sm font-medium">{ar ? 'طريقة العرض' : 'Display by'}
            <select className="mt-2 w-full rounded-xl border border-ink-200 p-3" value={grouped ? 'groups' : 'products'} onChange={e => go(selected, e.target.value === 'groups')}>
              <option value="products">{ar ? 'كل الأصناف بالصور' : 'All products with photos'}</option>
              <option value="groups">{ar ? 'حسب الأقسام / الشركات' : 'Categories / companies'}</option>
            </select>
          </label>
          {levels.map((parent, index) => {
            const children = categories.filter(c => (c.parent_id ?? null) === parent);
            if (!children.length) return null;
            const name = parent ? categories.find(c => c.id === parent)?.name : null;
            return <label key={parent ?? 'root'} className="block text-sm font-medium">
              {name ? `${ar ? 'داخل' : 'Within'} ${name}` : (ar ? 'القسم الرئيسي / الشركة' : 'Main category / company')}
              <select className="mt-2 w-full rounded-xl border border-ink-200 p-3" value={trail[index]?.id ?? ''} onChange={e => go(e.target.value || parent)}>
                <option value="">{ar ? 'الكل' : 'All'}</option>
                {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>;
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-ink-500">{products.length} {ar ? 'صنف' : 'products'}</p>
          {(selected || query || grouped) && <button type="button" className="text-brand-700 underline" onClick={() => { setQuery(''); go(null, false); }}>{ar ? 'مسح الفلاتر' : 'Clear filters'}</button>}
        </div>
      </section>
      <nav aria-label={ar ? 'مسار الأقسام' : 'Category path'} className="flex flex-wrap items-center gap-1 text-xs">
        <Link href={href(null)} scroll={false} prefetch={false} className="rounded-lg px-2 py-1 text-brand-700 hover:bg-brand-50">{ar ? 'كل الأصناف' : 'All products'}</Link>
        {trail.map((c, index) => <span key={c.id} className="flex items-center gap-2"><span aria-hidden="true">/</span><Link href={href(c.id)} scroll={false} prefetch={false} aria-current={index === trail.length - 1 ? 'page' : undefined} className="rounded-lg px-2 py-1 text-brand-700 hover:bg-brand-50">{c.name}</Link></span>)}
      </nav>
      <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{selected?trail.at(-1)?.name:(ar?"اكتشف الأصناف":"Discover products")}</h2><span className="text-xs text-ink-500">{orderingEnabled?(ar?"اضغط على الصنف للطلب":"Tap a product to order"):(ar?"اضغط لمعرفة التفاصيل":"Tap for details")}</span></div>
      {grouped ? groups.map(g => <section key={g.category.id} className="space-y-3"><h2 className="text-lg font-semibold"><Link href={href(g.category.id)} scroll={false} prefetch={false} className="text-brand-700">{g.path}</Link></h2><div className={grid}>{g.products.map(p => productCard(p, g.path))}</div></section>) : <div className={grid}>{products.map(({ product, path }) => productCard(product, path))}</div>}
      {!products.length && <p className="py-12 text-center text-ink-500">{ar ? 'مفيش أصناف مطابقة للبحث والفلاتر.' : 'No products match your search and filters.'}</p>}
    </main>
  </div>;
}
