"use client";

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useMenu } from '../MenuContext';
import { MenuImage } from '../MenuMedia';
import { categoryAncestors, categoryDescendants, categoryPath } from '@/lib/category-tree';
import { useI18n } from '@/components/i18n/I18nProvider';
import { priceRange } from '@/lib/utils';
import type { ProductWithVariants } from '@/lib/types';

export function RetailMenu() {
  const { data, currency, showPrices, openProduct } = useMenu();
  const { locale } = useI18n();
  const ar = locale === 'ar';
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [query, setQuery] = useState('');
  const { restaurant, categories } = data;
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
    return <button key={p.id} type="button" onClick={() => openProduct(p)} className="overflow-hidden rounded-2xl border border-ink-200 bg-white text-start hover:border-brand-400">
      <MenuImage src={p.image_url} alt={p.name} className="aspect-square w-full" sizes="(max-width:640px) 50vw, 240px" />
      <div className="p-3"><p className="font-semibold">{p.name}</p><p className="mt-1 text-xs text-ink-500">{path}</p>
        {showPrices && <p className="mt-2 text-sm font-bold text-brand-700">{priceRange(p.product_variants.map(v => Number(v.price)), currency)}</p>}
      </div>
    </button>;
  }
  const grid = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4';
  const levels = [null, ...trail.map(c => c.id)];

  return <div className="min-h-screen bg-ink-50 pb-24">
    <header className="border-b border-ink-100 bg-white px-5 py-8 text-center">
      {restaurant.logo_url && <MenuImage src={restaurant.logo_url} alt={restaurant.name} className="mx-auto size-20" sizes="80px" />}
      <h1 className="mt-3 text-2xl font-bold">{restaurant.name}</h1>
      {restaurant.description && <p className="mt-2 text-sm text-ink-500">{restaurant.description}</p>}
      {restaurant.address && <p className="mt-2 text-sm text-ink-500">{restaurant.address}</p>}
      {restaurant.phone && <a className="mt-2 inline-block text-brand-700" href={`tel:${restaurant.phone}`}>{restaurant.phone}</a>}
    </header>
    <main className="mx-auto max-w-5xl space-y-5 p-4">
      <section aria-label={ar ? 'البحث وتصفية الأصناف' : 'Search and filter products'} className="space-y-3 rounded-2xl border border-ink-200 bg-white p-4">
        <label className="block text-sm font-medium">{ar ? 'ابحث عن صنف أو شركة' : 'Search products or companies'}
          <input type="search" placeholder={ar ? 'اسم الصنف أو الشركة…' : 'Product or company name…'} className="mt-2 w-full rounded-xl border border-ink-200 p-3" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
      <nav aria-label={ar ? 'مسار الأقسام' : 'Category path'} className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={href(null)} scroll={false} prefetch={false} className="rounded-lg px-2 py-1 text-brand-700 hover:bg-brand-50">{ar ? 'كل الأصناف' : 'All products'}</Link>
        {trail.map((c, index) => <span key={c.id} className="flex items-center gap-2"><span aria-hidden="true">/</span><Link href={href(c.id)} scroll={false} prefetch={false} aria-current={index === trail.length - 1 ? 'page' : undefined} className="rounded-lg px-2 py-1 text-brand-700 hover:bg-brand-50">{c.name}</Link></span>)}
      </nav>
      {grouped ? groups.map(g => <section key={g.category.id} className="space-y-3"><h2 className="text-lg font-semibold"><Link href={href(g.category.id)} scroll={false} prefetch={false} className="text-brand-700">{g.path}</Link></h2><div className={grid}>{g.products.map(p => productCard(p, g.path))}</div></section>) : <div className={grid}>{products.map(({ product, path }) => productCard(product, path))}</div>}
      {!products.length && <p className="py-12 text-center text-ink-500">{ar ? 'مفيش أصناف مطابقة للبحث والفلاتر.' : 'No products match your search and filters.'}</p>}
    </main>
  </div>;
}
