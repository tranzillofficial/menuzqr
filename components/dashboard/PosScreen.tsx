"use client";

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/i18n/I18nProvider';
import { SmartImage } from '@/components/ui/SmartImage';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { checkoutPos } from '@/lib/actions/pos';
import { formatMoney, cn } from '@/lib/utils';
import type { ProductWithVariants, Category, RestaurantTable } from '@/lib/types';

type Line = { variantId: string; name: string; variant: string; price: number; quantity: number };

export function PosScreen({ restaurantName, currency, products, categories, tables }: {
  restaurantName: string; currency: string; products: ProductWithVariants[];
  categories: Category[]; tables: RestaurantTable[];
}) {
  const { locale } = useI18n();
  const label = (ar: string, en: string) => locale === 'ar' ? ar : en;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [cart, setCart] = useState<Line[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [table, setTable] = useState('');
  const [payment, setPayment] = useState<'cash' | 'card'>('cash');
  const [received, setReceived] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [pending, start] = useTransition();
  const [receipt, setReceipt] = useState<{ number: number; total: number; received: number; lines: Line[] } | null>(null);
  const request = useRef<string | null>(null);
  const money = (value: number) => formatMoney(value, currency);
  const total = Math.round(cart.reduce((sum, line) => sum + line.price * line.quantity, 0) * 100) / 100;
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const shown = products.filter(product =>
    (category === 'all' || product.category_id === category) &&
    `${product.name} ${product.description ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  );
  function changed() { request.current = null; setError(''); }
  function add(product: ProductWithVariants, variant: ProductWithVariants['product_variants'][number]) {
    if (pending || !variant.is_active || !Number.isFinite(Number(variant.price))) return;
    changed();
    setReceipt(null);
    setCart(previous => {
      const existing = previous.find(line => line.variantId === variant.id);
      return existing ? previous.map(line => line.variantId === variant.id ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line)
        : [...previous, { variantId: variant.id, name: product.name, variant: variant.name, price: Number(variant.price), quantity: 1 }];
    });
    setAnnouncement(`${label('اتضاف للطلب', 'Added to order')}: ${product.name}`);
  }
  function quantity(id: string, delta: number) {
    changed();
    setCart(previous => previous.map(line => line.variantId === id ? { ...line, quantity: Math.min(99, line.quantity + delta) } : line).filter(line => line.quantity > 0));
  }
  function pay() {
    if (!cart.length || pending) return;
    setError('');
    start(async () => {
      try {
        request.current ??= crypto.randomUUID();
        const result = await checkoutPos({ requestId: request.current, lines: cart.map(({ variantId, quantity }) => ({ variantId, quantity })), tableId: table || null, payment, received: payment === 'cash' ? Number(received) : total, note });
        if (!result.ok) { setError(result.message); return; }
        setReceipt({ number: result.orderNumber, total: result.total, received: result.received, lines: cart });
        setCart([]); setReceived(''); setNote(''); setTable(''); request.current = null;
        setAnnouncement(label('تم حفظ الطلب', 'Order saved'));
      } catch { setError(label('تعذر الاتصال. حاول تاني بنفس الطلب.', 'Connection interrupted. Retry this order.')); }
    });
  }

  const order = <div className="space-y-4">
    <fieldset disabled={pending} className="space-y-4">
      <select value={table} onChange={event => { setTable(event.target.value); changed(); }} aria-label={label('نوع الطلب', 'Order type')} className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm"><option value="">{label('تيك أواي', 'Takeaway')}</option>{tables.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      {!cart.length ? <div className="rounded-xl border border-dashed border-ink-200 px-4 py-10 text-center text-sm text-ink-500">{label('اختار المنتجات وهتظهر هنا', 'Added products appear here')}</div> :
        <ul data-testid="cart-lines" className="max-h-[38dvh] space-y-2 overflow-y-auto overscroll-contain">
          {cart.map(line => <li key={line.variantId} className="rounded-xl bg-ink-50 p-3">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-medium">{line.name}</p><p className="text-xs text-ink-500">{line.variant}</p></div><strong className="shrink-0 text-sm">{money(line.price * line.quantity)}</strong></div>
            <div className="mt-2 flex items-center gap-2"><button type="button" aria-label={`${label('تقليل كمية', 'Decrease')} ${line.name}`} onClick={() => quantity(line.variantId, -1)} className="size-9 rounded-lg border border-ink-200 bg-white">−</button><span className="min-w-6 text-center text-sm font-semibold">{line.quantity}</span><button type="button" disabled={line.quantity >= 99} aria-label={`${label('زيادة كمية', 'Increase')} ${line.name}`} onClick={() => quantity(line.variantId, 1)} className="size-9 rounded-lg border border-ink-200 bg-white disabled:opacity-40">+</button><button type="button" onClick={() => { changed(); setCart(previous => previous.filter(item => item.variantId !== line.variantId)); }} className="ms-auto px-2 py-2 text-xs text-red-600">{label('حذف', 'Remove')}</button></div>
          </li>)}
        </ul>}
      <input value={note} onChange={event => { setNote(event.target.value); changed(); }} maxLength={400} placeholder={label('ملاحظة للطلب', 'Order note')} aria-label={label('ملاحظة للطلب', 'Order note')} className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm" />
      <div className="flex justify-between border-t border-ink-100 pt-4 text-lg font-semibold"><span>{label('الإجمالي', 'Total')}</span><span data-testid="cart-total">{money(total)}</span></div>
      <div className="grid grid-cols-2 gap-2">{(['cash', 'card'] as const).map(value => <button key={value} type="button" aria-pressed={payment === value} onClick={() => { setPayment(value); changed(); }} className={cn('rounded-xl border py-2.5 text-sm', payment === value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200')}>{value === 'cash' ? label('كاش', 'Cash') : label('بطاقة', 'Card')}</button>)}</div>
      {payment === 'cash' && <label className="block text-sm">{label('المبلغ المستلم', 'Amount received')}<input type="number" inputMode="decimal" min={total} step="0.01" value={received} onChange={event => { setReceived(event.target.value); changed(); }} className="mt-2 h-11 w-full rounded-xl border border-ink-200 px-3" /><span className="mt-2 block text-xs text-ink-500">{label('الباقي', 'Change')}: {money(Math.max(0, Number(received) - total))}</span></label>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button type="button" className="w-full" size="lg" loading={pending} disabled={!cart.length || (payment === 'cash' && (!received || !Number.isFinite(Number(received)) || Number(received) < total))} onClick={pay}>{label('تأكيد الدفع', 'Confirm payment')}</Button>
    </fieldset>
    {receipt && <div className="rounded-xl bg-emerald-50 p-4"><p role="status" className="font-semibold text-emerald-800">{label('تم حفظ الطلب', 'Order saved')} #{receipt.number}</p><Button type="button" variant="secondary" className="mt-3 w-full" onClick={() => window.print()}>{label('طباعة الفاتورة', 'Print receipt')}</Button></div>}
  </div>;

  return <div className="space-y-4 pb-24 lg:pb-0">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">{label('الكاشير', 'Point of sale')}</h1><p className="text-xs text-ink-500">{restaurantName}</p></div><Link href="/dashboard/orders" className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm">{label('متابعة الطلبات', 'View orders')}</Link></header>
    <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_310px]">
      <section className="min-w-0" aria-label={label('المنتجات', 'Products')}>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={label('ابحث عن منتج', 'Search products')} aria-label={label('ابحث عن منتج', 'Search products')} className="h-11 w-full rounded-xl border border-ink-200 bg-white px-4 text-sm" />
        <div className="my-3 flex gap-2 overflow-x-auto pb-2">{[{ id: 'all', name: label('الكل', 'All') }, ...categories].map(item => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)} className={cn('min-h-10 shrink-0 rounded-xl px-3 text-xs font-medium', category === item.id ? 'bg-ink-900 text-white' : 'border border-ink-200 bg-white text-ink-600')}>{item.name}</button>)}</div>
        {shown.length === 0 && <div className="rounded-2xl border border-dashed border-ink-300 p-8 text-center text-sm"><p>{label('مفيش منتجات مطابقة', 'No matching products')}</p>{products.length ? <button type="button" onClick={() => { setQuery(''); setCategory('all'); }} className="mt-3 text-brand-700">{label('عرض كل المنتجات', 'Show all products')}</button> : <Link href="/dashboard/catalog" className="mt-3 inline-block text-brand-700">{label('ضيف من المنيو العام', 'Add from catalog')}</Link>}</div>}
        <div data-testid="product-grid" className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map(product => {
            const variants = product.product_variants.filter(variant => variant.is_active && Number.isFinite(Number(variant.price)));
            const added = cart.filter(line => variants.some(variant => variant.id === line.variantId)).reduce((sum, line) => sum + line.quantity, 0);
            return <article key={product.id} className={cn('min-w-0 overflow-hidden rounded-xl border bg-white', added ? 'border-brand-400 ring-1 ring-brand-100' : 'border-ink-200')}>
              <div className="relative aspect-[4/3] bg-white"><SmartImage src={product.image_url} alt={product.name} sizes="(max-width: 640px) 33vw, 180px" className="p-2" />{added > 0 && <span className="absolute end-1 top-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">{added} {label('في الطلب', 'added')}</span>}</div>
              <div className="space-y-2 p-2"><h2 className="min-h-8 text-xs font-semibold leading-4">{product.name}</h2>
                {variants.length === 0 && <p className="py-2 text-xs text-ink-400">{label('غير متاح حاليًا', 'Unavailable')}</p>}
                {variants.map(variant => <button key={variant.id} type="button" disabled={pending || (cart.find(line => line.variantId === variant.id)?.quantity ?? 0) >= 99} onClick={() => add(product, variant)} aria-label={`${label('إضافة', 'Add')} ${product.name} ${variant.name}`} className="flex min-h-11 w-full flex-wrap items-center justify-between gap-1 rounded-lg bg-brand-50 px-2 py-2 text-xs text-brand-800 hover:bg-brand-100 active:bg-brand-200 disabled:opacity-40"><span>{variants.length > 1 ? `+ ${variant.name}` : label('+ إضافة', '+ Add')}</span><strong className="whitespace-nowrap">{money(Number(variant.price))}</strong></button>)}
              </div>
            </article>;
          })}
        </div>
      </section>
      <aside data-testid="desktop-cart" className="sticky top-4 hidden min-w-0 rounded-2xl border border-ink-200 bg-white p-4 lg:block"><h2 className="mb-4 flex items-center justify-between font-semibold">{label('الطلب الحالي', 'Current order')}<span className="rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-700">{count}</span></h2>{order}</aside>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"><button type="button" onClick={() => setCartOpen(true)} aria-haspopup="dialog" className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white"><span>{label('عرض الطلب', 'View order')} ({count})</span><span>{money(total)}</span></button></div>
    <Modal open={cartOpen} onClose={() => setCartOpen(false)} title={`${label('الطلب الحالي', 'Current order')} (${count})`} size="sm">{order}</Modal>
    {receipt && <div id="pos-receipt" className="hidden"><h1>{restaurantName}</h1><p>#{receipt.number}</p>{receipt.lines.map(line => <div key={line.variantId}><span>{line.name} {line.variant} × {line.quantity}</span><strong>{money(line.price * line.quantity)}</strong></div>)}<hr /><p>{label('الإجمالي', 'Total')}: {money(receipt.total)}</p><p>{label('المستلم', 'Received')}: {money(receipt.received)}</p><p>{label('الباقي', 'Change')}: {money(receipt.received - receipt.total)}</p></div>}
  </div>;
}
