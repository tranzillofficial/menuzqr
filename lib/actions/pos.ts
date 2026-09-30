"use server";
import { getMembership } from '@/lib/membership';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { getPlatformSettings } from '@/lib/platform';
import { getLocale } from '@/lib/i18n/server';
import { hasPosAccess } from '@/lib/pos';
import { revalidatePath } from 'next/cache';
export async function checkoutPos(input:{requestId:string;lines:{variantId:string;quantity:number}[];tableId:string|null;note:string;payment:'cash'|'card';received:number|null}) {
  const [member,platform,locale] = await Promise.all([getMembership(),getPlatformSettings(),getLocale()]);
  const ar=locale==='ar';
  if (!member?.isManager || !hasPosAccess(member.restaurant,platform.posEnabled)) return {ok:false as const,message:ar?'اشتراك الكاشير مش مفعّل.':'POS access is not active.'};
  if (!Array.isArray(input.lines) || input.lines.length>100 || (input.received!==null && (!Number.isFinite(input.received) || input.received<0))) return {ok:false as const,message:ar?'راجع بيانات الطلب.':'Check your order.'};
  const {data,error}=await createAdminSupabase().rpc('create_pos_sale',{p_actor:member.userId,p_restaurant:member.restaurant.id,p_request:input.requestId,p_lines:input.lines,p_table:input.tableId,p_note:input.note,p_payment:input.payment,p_received:input.received});
  if(error) return {ok:false as const,message:ar?'تعذر حفظ الطلب. راجع المبلغ والمنتجات وحاول تاني.':'Could not save. Check the amount and product availability, then retry.'};
  revalidatePath('/dashboard/orders');
  revalidatePath('/dashboard');
  return {ok:true as const,orderNumber:Number(data.order_number),total:Number(data.total),received:Number(data.amount_received)};
}
