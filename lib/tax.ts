export const TAX_MODES = ['none', 'uk', 'uae', 'saudi', 'egypt'] as const;
export type TaxMode = typeof TAX_MODES[number];
export const VAT_CODES = ['standard', 'reduced', 'zero', 'exempt'] as const;
export type VatCode = typeof VAT_CODES[number];
export type MarketRates = Partial<Record<TaxMode, { standard: number; reduced: number }>>;
export type TaxSettings = { tax_mode: TaxMode; tax_rates?: MarketRates; menu_prices_include_vat?: boolean; vat_registered: boolean; vat_number: string | null; prices_include_vat: boolean; legal_name: string | null; tax_address: string | null; business_timezone: string };
export const MARKET = { none: { currency: '', timezone: 'Africa/Cairo', standard: 0 }, uk: { currency: 'GBP', timezone: 'Europe/London', standard: 20 }, uae: { currency: 'AED', timezone: 'Asia/Dubai', standard: 5 }, saudi: { currency: 'SAR', timezone: 'Asia/Riyadh', standard: 15 }, egypt: { currency: 'EGP', timezone: 'Africa/Cairo', standard: 14 } };
export function vatRate(mode: TaxMode, registered: boolean, code: VatCode, rates?: MarketRates) {
  if (registered && mode === 'egypt') return rates?.egypt?.standard ?? MARKET.egypt.standard;
  if (!registered || mode === 'none' || code === 'zero' || code === 'exempt') return 0;
  if (code === 'reduced') return rates?.[mode]?.reduced ?? (mode === 'uk' ? 5 : 0);
  return rates?.[mode]?.standard ?? MARKET[mode].standard;
}
export function taxAmounts(price: number, quantity: number, rate: number, inclusive: boolean) {
  const amount = Math.round((price * quantity + Number.EPSILON) * 100);
  const vat = inclusive ? Math.round(amount * rate / (100 + rate)) : Math.round(amount * rate / 100);
  const gross = inclusive ? amount : amount + vat;
  return { net: (gross - vat) / 100, vat: vat / 100, gross: gross / 100 };
}
export function displayPrice(price: number, code: VatCode, settings: Pick<TaxSettings, 'tax_mode' | 'vat_registered' | 'prices_include_vat' | 'tax_rates' | 'menu_prices_include_vat'>) {
  if (!settings.prices_include_vat && settings.menu_prices_include_vat === false) return Number(price);
  return taxAmounts(Number(price), 1, vatRate(settings.tax_mode, settings.vat_registered, code, settings.tax_rates), settings.prices_include_vat).gross;
}
export type VatBreakdown = { code: string; rate: number; net: number; vat: number; gross: number };
export type FiscalSnapshot = { invoice_kind: 'receipt' | 'simplified' | 'full'; version: number; mode: TaxMode; registered: boolean; vat_number: string | null; legal_name: string; address: string | null; timezone: string; inclusive: boolean; customer: { name?: string; address?: string; vat_number?: string }; net: number; vat: number; gross: number; breakdown: VatBreakdown[]; };
export type FinancialEvent = { id: number; order_id: string; kind: 'sale' | 'refund' | 'void'; currency: string; gross: number; net: number; vat: number; payment_method: string | null; reason: string | null; actor_id: string | null; actor_name: string | null; created_at: string; breakdown: VatBreakdown[]; document_number: string | null };
export type SalesSummary = { currencies: { currency: string; sales: number; cash: number; card: number; transfer?:number; refunds: number; voids: number; netSales: number; vat: number; breakdown: VatBreakdown[] }[]; saleCount: number; refundCount: number; voidCount: number; };
export function summarizeSales(events: FinancialEvent[]): SalesSummary {
  const currencies = new Map<string, SalesSummary['currencies'][number]>();
  for (const event of events) {
    const row = currencies.get(event.currency) ?? { currency: event.currency, sales: 0, cash: 0, card: 0, refunds: 0, voids: 0, netSales: 0, vat: 0, breakdown: [] };
    currencies.set(event.currency, row);
    const sign = event.kind === 'sale' ? 1 : event.kind === 'refund' ? -1 : 0;
    if (event.kind === 'sale') row.sales += Number(event.gross);
    if (event.kind === 'refund') row.refunds += Number(event.gross);
    if (event.kind === 'void') row.voids += Number(event.gross);
    if (event.payment_method === 'cash') row.cash += sign * Number(event.gross);
    if (event.payment_method === 'card') row.card += sign * Number(event.gross);
    if (event.payment_method === 'transfer') row.transfer=(row.transfer??0)+sign*Number(event.gross);
    row.netSales += sign * Number(event.gross); row.vat += sign * Number(event.vat);
    if (sign) for (const b of event.breakdown) {
      let existing = row.breakdown.find(x => x.code === b.code && Number(x.rate) === Number(b.rate));
      if (!existing) { existing = { code: b.code, rate: Number(b.rate), net: 0, vat: 0, gross: 0 }; row.breakdown.push(existing); }
      existing.net += sign * Number(b.net); existing.vat += sign * Number(b.vat); existing.gross += sign * Number(b.gross);
    }
  }
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  for (const r of currencies.values()) {
    for (const key of ['sales','cash','card','refunds','voids','netSales','vat'] as const) r[key] = round(r[key]);
    if(r.transfer!==undefined)r.transfer=round(r.transfer);
    for (const b of r.breakdown) { b.net = round(b.net); b.vat = round(b.vat); b.gross = round(b.gross); }
  }
  return { currencies: [...currencies.values()], saleCount: events.filter(e => e.kind === 'sale').length, refundCount: events.filter(e => e.kind === 'refund').length, voidCount: events.filter(e => e.kind === 'void').length };
}

// Egypt uses one invoice-wide tax amount, rounded once after summing prices.
export function orderTaxAmounts(lines: { price: number; quantity: number; rate: number }[], settings: Pick<TaxSettings, 'tax_mode' | 'vat_registered' | 'tax_rates' | 'prices_include_vat'>) {
  if (settings.tax_mode === 'egypt') {
    const subtotal = lines.reduce((sum, line) => sum + Math.round(line.price * line.quantity * 100), 0) / 100;
    return taxAmounts(subtotal, 1, vatRate('egypt', settings.vat_registered, 'standard', settings.tax_rates), settings.prices_include_vat);
  }
  return lines.reduce((sum, line) => {
    const amount = taxAmounts(line.price, line.quantity, line.rate, settings.prices_include_vat);
    return { net: Math.round((sum.net + amount.net) * 100) / 100, vat: Math.round((sum.vat + amount.vat) * 100) / 100, gross: Math.round((sum.gross + amount.gross) * 100) / 100 };
  }, { net: 0, vat: 0, gross: 0 });
}
