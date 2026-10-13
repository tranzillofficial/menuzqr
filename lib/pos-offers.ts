import type { BusinessOffer } from './types';
export type AppliedOffer = { id: string; title: string; count: number; saving: number };
// Deterministic priority: greatest saving per complete offer, then offer ID.
// Each unit participates in one offer. Allocate cents cumulatively, never by rounding unit prices.
export function pricePosOffers<T extends { variantId: string; quantity: number; basePrice: number }>(lines: T[], offers: BusinessOffer[], now = Date.now()) {
  const remaining = new Map(lines.map(l => [l.variantId, l.quantity]));
  const prices = new Map(lines.map(l => [l.variantId, Math.round(l.basePrice * 100)]));
  const discounts = new Map<string, number>();
  const applied: AppliedOffer[] = [];
  const candidates = offers.filter(o => o.is_active && (!o.starts_at || Date.parse(o.starts_at) <= now) && (!o.ends_at || Date.parse(o.ends_at) > now) && ['bundle','discount'].includes(o.offer_type ?? '')).flatMap(o => {
    const items = [...(o.bundle_items ?? [])].sort((a,b) => a.variant_id.localeCompare(b.variant_id));
    if (!items.length || items.some(i => !prices.has(i.variant_id) || !Number.isInteger(i.quantity) || i.quantity < 1) || new Set(items.map(i=>i.variant_id)).size !== items.length) return [];
    const original = items.reduce((s,i) => s + prices.get(i.variant_id)! * i.quantity, 0);
    const sale = o.offer_type === 'bundle' ? Math.round(Number(o.sale_price) * 100) : o.discount_kind === 'fixed' ? original - Math.round(Number(o.discount_value) * 100) : Math.round(original * (100 - Number(o.discount_value)) / 100);
    const saving = original - sale;
    return Number.isFinite(saving) && saving > 0 && sale >= 0 ? [{o,items,original,saving}] : [];
  }).sort((a,b) => b.saving-a.saving || a.o.id.localeCompare(b.o.id));
  for (const {o,items,original,saving} of candidates) {
    const count = Math.min(...items.map(i => Math.floor((remaining.get(i.variant_id) ?? 0) / i.quantity)));
    if (!count) continue;
    let cumulative = 0, allocated = 0;
    for (const i of items) {
      cumulative += prices.get(i.variant_id)! * i.quantity;
      const next = Math.round(cumulative * saving * count / original);
      discounts.set(i.variant_id, (discounts.get(i.variant_id) ?? 0) + next - allocated);
      allocated = next;
      remaining.set(i.variant_id, remaining.get(i.variant_id)! - i.quantity * count);
    }
    applied.push({id:o.id,title:o.title,count,saving:saving*count/100});
  }
  const priced = lines.map(l => ({...l,discount:(discounts.get(l.variantId) ?? 0)/100,baseTotal:(prices.get(l.variantId)!*l.quantity-(discounts.get(l.variantId) ?? 0))/100}));
  return {lines:priced,applied,discount:applied.reduce((s,o)=>Math.round((s+o.saving)*100)/100,0)};
}
