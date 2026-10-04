"use client";

import { categoryDescendants } from "@/lib/category-tree";
import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/i18n/I18nProvider';
import { SmartImage } from '@/components/ui/SmartImage';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { checkoutPos, getPosTables } from '@/lib/actions/pos';
import { CategoryPicker } from "./CategoryPicker";
import { ThermalPrinter, type ReceiptPrinterHandle } from '@/components/dashboard/ThermalPrinter';
import type { PosReceipt } from '@/lib/thermal-print';
import { displayPrice, taxAmounts, vatRate, type TaxSettings } from '@/lib/tax';
import { formatMoney, cn } from '@/lib/utils';
import type { ProductWithVariants, Category, RestaurantTable } from '@/lib/types';

type Line = { variantId: string; name: string; variant: string; price: number; quantity: number; basePrice: number; rate: number };

export function PosScreen({ restaurantId, restaurantName, currency, products, categories, tables, taxSettings, tablesEnabled = true }: {
  restaurantId: string; restaurantName: string; currency: string; products: ProductWithVariants[];
  tablesEnabled?: boolean; categories: Category[]; tables: RestaurantTable[]; taxSettings: TaxSettings;
}) {
  const { locale } = useI18n();
  const label = (ar: string, en: string) => locale === 'ar' ? ar : en;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [cart, setCart] = useState<Line[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [table, setTable] = useState('');
  const [orderType, setOrderType] = useState<'takeaway' | 'dinein'>('takeaway');
  const [availableTables, setAvailableTables] = useState<Pick<RestaurantTable, 'id' | 'label'>[]>(tables);
  const [refreshingTables, setRefreshingTables] = useState(false);
  const [payment, setPayment] = useState<'cash' | 'card'>('cash');
  const [received, setReceived] = useState('');
  const [fullInvoice, setFullInvoice] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerVat, setCustomerVat] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [pending, start] = useTransition();
  const [receipt, setReceipt] = useState<PosReceipt | null>(null);
  const printer = useRef<ReceiptPrinterHandle>(null);
  const request = useRef<string | null>(null);
  const money = (value: number) => formatMoney(value, currency);
  const totals = cart.map(line => taxAmounts(line.basePrice, line.quantity, line.rate, taxSettings.prices_include_vat));
  const total = Math.round(totals.reduce((sum, line) => sum + line.gross, 0) * 100) / 100;
  const vat = Math.round(totals.reduce((sum, line) => sum + line.vat, 0) * 100) / 100;
  const grossPrice = (price: number, product: ProductWithVariants) => displayPrice(Number(price), product.vat_code, taxSettings);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const shown = products.filter(product =>
    (category === 'all' || categoryDescendants(categories,category).has(product.category_id ?? "")) &&
    `${product.name} ${product.description ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  );
  function changed() { request.current = null; setError(''); }
  function add(product: ProductWithVariants, variant: ProductWithVariants['product_variants'][number]) {
    if (pending || !variant.is_active || !Number.isFinite(Number(variant.price))) return;
    changed();
    setCart(previous => {
      const existing = previous.find(line => line.variantId === variant.id);
      return existing ? previous.map(line => line.variantId === variant.id ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line)
        : [...previous, { variantId: variant.id, name: product.name, variant: variant.name, price: grossPrice(Number(variant.price), product), basePrice: Number(variant.price), rate: vatRate(taxSettings.tax_mode,taxSettings.vat_registered,product.vat_code,taxSettings.tax_rates), quantity: 1 }];
    });
    setAnnouncement(`${label('اتضاف للطلب', 'Added to order')}: ${product.name}`);
  }
  function quantity(id: string, delta: number) {
    changed();
    setCart(previous => previous.map(line => line.variantId === id ? { ...line, quantity: Math.min(99, line.quantity + delta) } : line).filter(line => line.quantity > 0));
  }
  function pay() {
    if (!cart.length || pending) return;
    if (orderType === 'dinein' && !availableTables.some(item => item.id === table)) {
      setError(label('اختار طاولة من الطاولات المفعّلة.', 'Select an active restaurant table.')); return;
    }
    setError('');
    start(async () => {
      try {
        request.current ??= crypto.randomUUID();
        const result = await checkoutPos({ requestId: request.current, lines: cart.map(({ variantId, quantity }) => ({ variantId, quantity })), tableId: table || null, payment, received: payment === 'cash' ? Number(received) : total, note, customer: { full_invoice: fullInvoice, name: customerName, address: customerAddress, vat_number: customerVat } });
        if (!result.ok) { setError(result.message); return; }
        setReceipt(result.receipt);
        setCart([]); setFullInvoice(false); setCustomerName(''); setCustomerAddress(''); setCustomerVat(''); setReceived(''); setNote(''); setTable(''); setCartOpen(false); request.current = null;
        setAnnouncement(label('تم حفظ الطلب', 'Order saved'));
        await printer.current?.printReceipt(result.receipt);
      } catch { setError(label('تعذر الاتصال. حاول تاني بنفس الطلب.', 'Connection interrupted. Retry this order.')); }
    });
  }

  async function refreshTables() {
    if (refreshingTables || pending) return;
    setRefreshingTables(true);
    try {
      const result = await getPosTables();
      if (!result.ok) { setError(result.message); return; }
      setAvailableTables(result.tables);
      if (table && !result.tables.some(item => item.id === table)) { setTable(''); changed(); }
    } catch { setError(label('تعذر تحديث الطاولات. حاول تاني.', 'Could not refresh tables. Try again.')); }
    finally { setRefreshingTables(false); }
  }

  const order = <div className="space-y-4">
    <fieldset disabled={pending} className="space-y-4">
      {tablesEnabled && <div className="grid grid-cols-2 gap-2" aria-label={label('نوع الطلب', 'Order type')}>{(['takeaway','dinein'] as const).map(type => <button key={type} type="button" aria-pressed={orderType === type} onClick={() => { setOrderType(type); setTable(''); changed(); if (type === 'dinein') void refreshTables(); }} className={cn('rounded-xl border py-2.5 text-sm', orderType === type ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200')}>{type === 'takeaway' ? label('تيك أواي', 'Takeaway') : label('داخل المطعم', 'Dine in')}</button>)}</div>}
      {orderType === 'dinein' && <div className="space-y-2">
        <div className="flex items-center justify-between text-sm"><span>{label('الطاولة', 'Table')} ({availableTables.length})</span><button type="button" disabled={refreshingTables} onClick={refreshTables} className="text-brand-700">{refreshingTables ? label('جاري التحديث', 'Refreshing') : label('تحديث', 'Refresh')}</button></div>
        <select aria-label={label('اختار طاولة', 'Select a table')} value={table} onChange={event => { setTable(event.target.value); changed(); }} className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm"><option value="">{label('اختار طاولة', 'Select a table')}</option>{availableTables.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        {!availableTables.length && <p className="text-xs text-ink-500">{label('مفيش طاولات مفعّلة.', 'No active tables.')} <Link href="/dashboard/tables" className="text-brand-700">{label('إدارة الطاولات', 'Manage tables')}</Link></p>}
      </div>}
      {!cart.length ? <div className="rounded-xl border border-dashed border-ink-200 px-4 py-10 text-center text-sm text-ink-500">{label('اختار المنتجات وهتظهر هنا', 'Added products appear here')}</div> :
        <ul data-testid="cart-lines" className="max-h-[38dvh] space-y-2 overflow-y-auto overscroll-contain">
          {cart.map(line => <li key={line.variantId} className="rounded-xl bg-ink-50 p-3">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-medium">{line.name}</p><p className="text-xs text-ink-500">{line.variant}</p></div><strong className="shrink-0 text-sm">{money(taxSettings.prices_include_vat || taxSettings.menu_prices_include_vat !== false ? taxAmounts(line.basePrice, line.quantity, line.rate, taxSettings.prices_include_vat).gross : line.basePrice * line.quantity)}</strong></div>
            <div className="mt-2 flex items-center gap-2"><button type="button" aria-label={`${label('تقليل كمية', 'Decrease')} ${line.name}`} onClick={() => quantity(line.variantId, -1)} className="size-9 rounded-lg border border-ink-200 bg-white">−</button><span className="min-w-6 text-center text-sm font-semibold">{line.quantity}</span><button type="button" disabled={line.quantity >= 99} aria-label={`${label('زيادة كمية', 'Increase')} ${line.name}`} onClick={() => quantity(line.variantId, 1)} className="size-9 rounded-lg border border-ink-200 bg-white disabled:opacity-40">+</button><button type="button" onClick={() => { changed(); setCart(previous => previous.filter(item => item.variantId !== line.variantId)); }} className="ms-auto px-2 py-2 text-xs text-red-600">{label('حذف', 'Remove')}</button></div>
          </li>)}
        </ul>}
      <input value={note} onChange={event => { setNote(event.target.value); changed(); }} maxLength={400} placeholder={label('ملاحظة للطلب', 'Order note')} aria-label={label('ملاحظة للطلب', 'Order note')} className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm" />
      <div className="space-y-1 text-sm"><p className="flex justify-between"><span>{label('قبل الضريبة', 'Subtotal')}</span><span>{money(total - vat)}</span></p><p className="flex justify-between"><span>VAT</span><span>{money(vat)}</span></p></div>
      {taxSettings.vat_registered && ['uk','uae'].includes(taxSettings.tax_mode) && <div className="space-y-2 text-sm">
        <label className="flex gap-2"><input type="checkbox" checked={fullInvoice} onChange={e => { setFullInvoice(e.target.checked); changed(); }} />{label('فاتورة ضريبية كاملة', 'Full VAT invoice')}</label>
        {fullInvoice && <><input aria-label="Customer name" placeholder={label('اسم العميل', 'Customer name')} value={customerName} onChange={e => { setCustomerName(e.target.value); changed(); }} className="h-11 w-full rounded-xl border px-3" /><input aria-label="Customer address" placeholder={label('عنوان العميل', 'Customer address')} value={customerAddress} onChange={e => { setCustomerAddress(e.target.value); changed(); }} className="h-11 w-full rounded-xl border px-3" /><input aria-label="Customer VAT number" placeholder={label('رقم ضريبة العميل إن وجد', 'Customer VAT number, if registered')} value={customerVat} onChange={e => { setCustomerVat(e.target.value); changed(); }} className="h-11 w-full rounded-xl border px-3" /></>}
      </div>}
      <div className="flex justify-between border-t border-ink-100 pt-4 text-lg font-semibold"><span>{label('الإجمالي', 'Total')}</span><span data-testid="cart-total">{money(total)}</span></div>
      <div className="grid grid-cols-2 gap-2">{(['cash', 'card'] as const).map(value => <button key={value} type="button" aria-pressed={payment === value} onClick={() => { setPayment(value); changed(); }} className={cn('rounded-xl border py-2.5 text-sm', payment === value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200')}>{value === 'cash' ? label('كاش', 'Cash') : label('بطاقة', 'Card')}</button>)}</div>
      {payment === 'cash' && <label className="block text-sm">{label('المبلغ المستلم', 'Amount received')}<input type="number" inputMode="decimal" min={total} step="0.01" value={received} onChange={event => { setReceived(event.target.value); changed(); }} className="mt-2 h-11 w-full rounded-xl border border-ink-200 px-3" /><span className="mt-2 block text-xs text-ink-500">{label('الباقي', 'Change')}: {money(Math.max(0, Number(received) - total))}</span></label>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button type="button" className="w-full" size="lg" loading={pending} disabled={!cart.length || (fullInvoice && (customerName.trim().length < 2 || customerAddress.trim().length < 5)) || refreshingTables || (orderType === 'dinein' && !availableTables.some(item => item.id === table)) || (payment === 'cash' && (!received || !Number.isFinite(Number(received)) || Number(received) < total))} onClick={pay}>{label('تأكيد الدفع', 'Confirm payment')}</Button>
    </fieldset>
    {receipt && <div className="rounded-xl bg-emerald-50 p-4"><p role="status" className="font-semibold text-emerald-800">{label('تم حفظ الطلب', 'Order saved')} #{receipt.number}</p>{receipt.orderId && <Link href={`/dashboard/orders/${receipt.orderId}`} className="text-sm text-brand-700">{label('الفاتورة والسجل', 'Invoice and journal')}</Link>}<p className="mt-1 text-sm">{receipt.tableLabel ? `${label('الطاولة', 'Table')}: ${receipt.tableLabel}` : label('تيك أواي', 'Takeaway')}</p></div>}
  </div>;

  return <div className="space-y-4 pb-24 lg:pb-0">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">{label('الكاشير', 'Point of sale')}</h1><p className="text-xs text-ink-500">{restaurantName}</p></div><Link href="/dashboard/orders" className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm">{label('متابعة الطلبات', 'View orders')}</Link><Link href="/dashboard/reports" className="rounded-xl border px-3 py-2 text-sm">{label('التقارير وإغلاق اليوم', 'Reports and end of day')}</Link></header>
    <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
    <ThermalPrinter compact printRef={printer} restaurantId={restaurantId} restaurantName={restaurantName} currency={currency} receipt={receipt} />
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_310px]">
      <section className="min-w-0" aria-label={label('المنتجات', 'Products')}>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={label('ابحث عن منتج', 'Search products')} aria-label={label('ابحث عن منتج', 'Search products')} className="h-11 w-full rounded-xl border border-ink-200 bg-white px-4 text-sm" />
        <div className="my-3"><CategoryPicker categories={categories} value={category==='all'?'':category} onChange={id=>setCategory(id||'all')} emptyLabel={label('كل الأقسام','All categories')} /></div>
        {shown.length === 0 && <div className="rounded-2xl border border-dashed border-ink-300 p-8 text-center text-sm"><p>{label('مفيش منتجات مطابقة', 'No matching products')}</p>{products.length ? <button type="button" onClick={() => { setQuery(''); setCategory('all'); }} className="mt-3 text-brand-700">{label('عرض كل المنتجات', 'Show all products')}</button> : <Link href="/dashboard/products" className="mt-3 inline-block text-brand-700">{label('ضيف منتجاتك', 'Add your products')}</Link>}</div>}
        <div data-testid="product-grid" className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map(product => {
            const variants = product.product_variants.filter(variant => variant.is_active && Number.isFinite(Number(variant.price)));
            const added = cart.filter(line => variants.some(variant => variant.id === line.variantId)).reduce((sum, line) => sum + line.quantity, 0);
            return <article key={product.id} className={cn('min-w-0 overflow-hidden rounded-xl border bg-white', added ? 'border-brand-400 ring-1 ring-brand-100' : 'border-ink-200')}>
              <div className="relative aspect-[4/3] bg-white"><SmartImage src={product.image_url} alt={product.name} sizes="(max-width: 640px) 33vw, 180px" className="p-2" />{added > 0 && <span className="absolute end-1 top-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">{added} {label('في الطلب', 'added')}</span>}</div>
              <div className="space-y-2 p-2"><h2 className="min-h-8 text-xs font-semibold leading-4">{product.name}</h2>
                {variants.length === 0 && <p className="py-2 text-xs text-ink-400">{label('غير متاح حاليًا', 'Unavailable')}</p>}
                {variants.map(variant => <button key={variant.id} type="button" disabled={pending || (cart.find(line => line.variantId === variant.id)?.quantity ?? 0) >= 99} onClick={() => add(product, variant)} aria-label={`${label('إضافة', 'Add')} ${product.name} ${variant.name}`} className="flex min-h-11 w-full flex-wrap items-center justify-between gap-1 rounded-lg bg-brand-50 px-2 py-2 text-xs text-brand-800 hover:bg-brand-100 active:bg-brand-200 disabled:opacity-40"><span>{variants.length > 1 ? `+ ${variant.name}` : label('+ إضافة', '+ Add')}</span><strong className="whitespace-nowrap">{money(grossPrice(Number(variant.price), product))}</strong></button>)}
              </div>
            </article>;
          })}
        </div>
      </section>
      <aside data-testid="desktop-cart" className="sticky top-4 hidden min-w-0 rounded-2xl border border-ink-200 bg-white p-4 lg:block"><h2 className="mb-4 flex items-center justify-between font-semibold">{label('الطلب الحالي', 'Current order')}<span className="rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-700">{count}</span></h2>{order}</aside>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"><button type="button" onClick={() => setCartOpen(true)} aria-haspopup="dialog" className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white"><span>{label('عرض الطلب', 'View order')} ({count})</span><span>{money(total)}</span></button></div>
    <Modal open={cartOpen} onClose={() => setCartOpen(false)} title={`${label('الطلب الحالي', 'Current order')} (${count})`} size="sm">{order}</Modal>
    {receipt && <div id="pos-receipt" className="hidden"><h1>{receipt.fiscal?.legal_name ?? restaurantName}</h1><p>{receipt.fiscal?.address}</p>{receipt.fiscal?.registered && <p>VAT / TRN: {receipt.fiscal.vat_number}</p>}<p>#{receipt.number}</p>{receipt.lines.map((line,i) => <div key={i}><span>{line.name} {line.variant} × {line.quantity} · {line.code} {line.rate}%</span><strong>{money(line.gross ?? line.price * line.quantity)}</strong></div>)}<hr /><p>{label('قبل الضريبة', 'Subtotal')}: {money(receipt.fiscal?.net ?? receipt.total)}</p><p>VAT: {money(receipt.fiscal?.vat ?? 0)}</p><p>{label('الإجمالي', 'Total')}: {money(receipt.total)}</p></div>}

  </div>;
}
