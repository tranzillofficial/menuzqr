"use server";
import { moduleEnabled } from "@/lib/business-modules";
import { getMembership } from '@/lib/membership';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { getPlatformSettings } from '@/lib/platform';
import { getLocale } from '@/lib/i18n/server';
import { hasPosAccess } from '@/lib/pos';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';
import type { PosReceipt } from '@/lib/thermal-print';

export async function getPosTables() {
  const [member, platform, locale] = await Promise.all([getMembership(), getPlatformSettings(), getLocale()]);
  const ar = locale === 'ar';
  if (!member?.isManager || !hasPosAccess(member.restaurant, platform.posEnabled)) return { ok: false as const, message: ar ? 'اشتراك الكاشير مش مفعّل.' : 'POS access is not active.' };
  if (!moduleEnabled(member.restaurant,"tables")) return {ok:true as const,tables:[]};
  const db = await createServerSupabase();
  const { data, error } = await db.from('restaurant_tables').select('id,label')
    .eq('restaurant_id', member.restaurant.id).eq('is_active', true).order('sort_order');
  if (error) return { ok: false as const, message: ar ? 'تعذر تحديث الطاولات.' : 'Could not refresh tables.' };
  return { ok: true as const, tables: data as { id: string; label: string }[] };
}
export async function checkoutPos(input:{requestId:string;lines:{variantId:string;quantity:number}[];tableId:string|null;note:string;payment:'cash'|'card';received:number|null;customer?:{full_invoice:boolean;name:string;address:string;vat_number:string}}) {
  const [member,platform,locale] = await Promise.all([getMembership(),getPlatformSettings(),getLocale()]);
  const ar=locale==='ar';
  if (!member?.isManager || !hasPosAccess(member.restaurant,platform.posEnabled)) return {ok:false as const,message:ar?'اشتراك الكاشير مش مفعّل.':'POS access is not active.'};
  if (input.tableId && !moduleEnabled(member.restaurant,"tables")) return {ok:false as const,message:"Tables are disabled for this account."};
  if (!Array.isArray(input.lines) || input.lines.length>100 || (input.received!==null && (!Number.isFinite(input.received) || input.received<0))) return {ok:false as const,message:ar?'راجع بيانات الطلب.':'Check your order.'};
  const db = createAdminSupabase();
  const {data,error}=await db.rpc('create_fiscal_order',{p_actor:member.userId,p_restaurant:member.restaurant.id,p_request:input.requestId,p_lines:input.lines,p_table:input.tableId,p_note:input.note,p_payment:input.payment,p_received:input.received,p_customer:input.customer??{}});
  if(error) return {ok:false as const,message:ar?'تعذر حفظ الطلب. راجع المبلغ والمنتجات وحاول تاني.':'Could not save. Check the amount and product availability, then retry.'};
  revalidatePath('/dashboard/orders');
  revalidatePath('/dashboard');
  // Print the persisted prices and items, including on idempotent retries.
  const [items, table] = await Promise.all([
    db.from('order_items').select('id,variant_id,product_name,variant_name,unit_price,quantity,line_total,net_total,vat_total,vat_rate,vat_code').eq('order_id',data.id).eq('restaurant_id',member.restaurant.id).order('id'),
    data.table_id ? db.from('restaurant_tables').select('label').eq('id',data.table_id).eq('restaurant_id',member.restaurant.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (items.error || table.error) return {ok:false as const,message:ar?'الطلب اتحفظ، لكن تعذر تحميل الإيصال. حاول تاني بنفس الطلب.':'Order saved, but the receipt could not load. Retry this same order.'};
  const receipt: PosReceipt = {
    orderId: data.id, currency: data.currency, fiscal: data.fiscal_snapshot, paidAt: data.paid_at,
    number: Number(data.order_number), total: Number(data.total), received: Number(data.amount_received),
    tableLabel: table.data?.label ?? null, payment: data.payment_method, createdAt: data.created_at, note: data.note ?? '',
    lines: (items.data ?? []).map(item => ({ variantId: item.variant_id ?? item.id, name: item.product_name, variant: item.variant_name ?? '', price: Number(item.unit_price), quantity: item.quantity, gross: Number(item.line_total), net: Number(item.net_total), vat: Number(item.vat_total), rate: Number(item.vat_rate), code: item.vat_code })),
  };
  return {ok:true as const,receipt};
}
