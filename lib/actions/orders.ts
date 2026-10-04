"use server";

import { moduleEnabled } from "@/lib/business-modules";
import { getMembership } from "@/lib/membership";
import { staffPermissions, statusPermission } from "@/lib/staff-permissions";
import {getTenantDomain} from "@/lib/tenant-domain";
import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";
import { publishEvent } from "@/lib/notify";
import type { ActionState } from "@/lib/types";
import { done, fail, getMemberContext } from "./helpers";

/**
 * A signed-in member of this restaurant, if any.
 *
 * Used for two things: letting a waiter place an order from a table QR even
 * when guest ordering is switched off, and stamping who placed it.
 */
async function memberOf(restaurantId: string): Promise<string | null> {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await createAdminSupabase()
      .from("restaurant_members")
      .select("user_id, role, service_permissions")
      .eq("restaurant_id", restaurantId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    return data && staffPermissions(data.role, data.service_permissions).includes("orders.create") ? user.id : null;
  } catch {
    return null;
  }
}

export type CartLine = {
  variantId: string;
  quantity: number;
  note?: string;
};

export type PlaceOrderResult =
  | { ok: true; orderNumber: number; publicToken: string; total: number; currency: string }
  | { ok: false; message: string };

const MAX_LINES = 40;

/**
 * Guest checkout from a table QR code.
 *
 * Runs with the service role because the customer is anonymous, so every
 * precondition is verified here: the restaurant must be activated, ordering
 * must be on, the table token must be valid, and every price is re-read from
 * the database. the client's prices are never trusted.
 */
export async function placeOrderAction(
  slug: string,
  tableToken: string,
  lines: CartLine[],
  orderNote: string,
  sessionId: string
): Promise<PlaceOrderResult> {
  const domain=await getTenantDomain();if(domain&&domain.restaurants.slug!==slug)return {ok:false,message:"This link belongs to a different business."};
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false, message: "Your cart is empty." };
  }
  if (lines.length > MAX_LINES) {
    return { ok: false, message: "Too many items in one order." };
  }

  const supabase = createAdminSupabase();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, status, enabled_modules, ordering_enabled, currency, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!restaurant) return { ok: false, message: "Restaurant not found." };
  if (restaurant.status !== "active") {
    return { ok: false, message: "This menu is not accepting orders right now." };
  }

  // When the owner turns guest ordering off, the QR code still works for the
  // restaurant's own staff: a waiter scans the table and takes the order.
  const staffId = await memberOf(restaurant.id);

  if (!moduleEnabled(restaurant,"orders") || !moduleEnabled(restaurant,"tables")) return {ok:false,message:"Table ordering is unavailable."};
  if (!restaurant.ordering_enabled && !staffId) {
    return { ok: false, message: "Table ordering is turned off for this restaurant." };
  }

  const { data: table } = await supabase
    .from("restaurant_tables")
    .select("id, label")
    .eq("restaurant_id", restaurant.id)
    .eq("qr_token", tableToken)
    .eq("is_active", true)
    .maybeSingle();

  if (!table) {
    return { ok: false, message: "This table QR code is no longer valid. Ask a waiter for help." };
  }

  // Light abuse guard: at most 5 open orders per table.
  const { count: openOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("table_id", table.id)
    .in("status", ["pending", "accepted", "preparing", "ready"]);

  if ((openOrders ?? 0) >= 5) {
    return {
      ok: false,
      message: "There are already several open orders for this table. Please ask your waiter.",
    };
  }

  const { data: order, error } = await supabase.rpc('create_fiscal_order', {
    p_actor: staffId, p_restaurant: restaurant.id, p_request: null,
    p_lines: lines, p_table: table.id, p_note: orderNote.trim().slice(0, 400),
    p_payment: null, p_received: null, p_customer: {}, p_guest: true, p_session: sessionId.slice(0, 64),
  });
  if (error || !order) return { ok: false, message: 'We could not send your order. Refresh the menu and try again.' };
  const total = Number(order.total);

  await publishEvent({
    id: `order.new:${order.id}`,
    kind: "order.new",
    restaurantId: restaurant.id,
    orderId: order.id,
    orderNumber: order.order_number,
    tableLabel: table.label,
    total,
    currency: restaurant.currency,
  });

  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard/orders");
  revalidatePath("/station");

  return {
    ok: true,
    orderNumber: order.order_number,
    publicToken: order.public_token,
    total,
    currency: restaurant.currency,
  };
}

export async function placeOnlineOrderAction(slug:string, lines:CartLine[], note:string, session:string, request:string, customer:{name:string;phone:string}):Promise<PlaceOrderResult> {
  const domain=await getTenantDomain();if(domain&&domain.restaurants.slug!==slug)return {ok:false,message:"This link belongs to a different business."};
 if (!Array.isArray(lines)||!lines.length||lines.length>MAX_LINES||!customer||typeof customer.name!=='string'||typeof customer.phone!=='string'||typeof note!=='string'||typeof session!=='string'||session.length<16||session.length>64||typeof request!=='string'||! /^[0-9a-f-]{36}$/i.test(request)) return {ok:false,message:'بيانات الطلب غير مكتملة.'};
 const name=customer.name.trim().slice(0,160),phone=customer.phone.replace(/[\s()-]/g,'');
 if(name.length<2||!/^\+?\d{8,15}$/.test(phone))return {ok:false,message:'اكتب الاسم ورقم الموبايل بشكل صحيح.'};
 const db=createAdminSupabase();
 const {data:r}=await db.from('restaurants').select('id,currency,enabled_modules').eq('slug',slug).maybeSingle();
 if(!r||!moduleEnabled(r,'orders')) return {ok:false,message:'استقبال الطلبات غير متاح.'};
 const {data:o,error}=await db.rpc('create_fiscal_order',{p_actor:null,p_restaurant:r.id,p_request:request,p_lines:lines,p_table:null,p_note:note.trim().slice(0,400),p_payment:null,p_received:null,p_customer:{name,phone},p_guest:true,p_session:session});
 if(error||!o)return {ok:false,message:'تعذر إرسال الطلب. راجع البيانات أو تواصل مع المكان.'};
 await publishEvent({id:`order.new:${o.id}`,kind:'order.new',restaurantId:r.id,orderId:o.id,orderNumber:o.order_number,tableLabel:null,total:Number(o.total),currency:o.currency});
 revalidatePath('/dashboard/orders');revalidatePath('/dashboard/pos');revalidatePath('/station');
 return {ok:true,orderNumber:o.order_number,publicToken:o.public_token,total:Number(o.total),currency:o.currency};
}

export async function callWaiterAction(
  slug: string,
  tableToken: string
): Promise<{ ok: boolean; message: string }> {
  const domain=await getTenantDomain();if(domain&&domain.restaurants.slug!==slug)return {ok:false,message:"This link belongs to a different business."};
  const supabase = createAdminSupabase();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, status, enabled_modules, waiter_calls_enabled")
    .eq("slug", slug)
    .maybeSingle();

  if (!restaurant || restaurant.status !== "active") {
    return { ok: false, message: "This menu is not available right now." };
  }

  // Same rule as ordering: the restaurant's own staff can still use the QR
  // code when the owner has switched guest calls off.
  const staffId = await memberOf(restaurant.id);

  if (!moduleEnabled(restaurant,"service_calls") || !moduleEnabled(restaurant,"tables")) return {ok:false,message:"Service calls are unavailable."};
  if (!restaurant.waiter_calls_enabled && !staffId) {
    return { ok: false, message: "Waiter calls are turned off for this restaurant." };
  }

  const { data: table } = await supabase
    .from("restaurant_tables")
    .select("id, label")
    .eq("restaurant_id", restaurant.id)
    .eq("qr_token", tableToken)
    .eq("is_active", true)
    .maybeSingle();

  if (!table) return { ok: false, message: "This table QR code is no longer valid." };

  // Don't spam staff: reuse an existing pending call from the last 3 minutes.
  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("waiter_requests")
    .select("id")
    .eq("table_id", table.id)
    .eq("status", "pending")
    .gte("created_at", threeMinutesAgo)
    .limit(1);

  if (recent && recent.length > 0) {
    return { ok: true, message: `A waiter is already on the way to ${table.label}.` };
  }

  const { data: created, error } = await supabase
    .from("waiter_requests")
    .insert({
      restaurant_id: restaurant.id,
      table_id: table.id,
      origin: "guest",
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: "Could not call the waiter. Please try again." };

  await publishEvent({
    id: `waiter:${created?.id ?? `${table.id}-${Date.now()}`}`,
    kind: "waiter.call",
    restaurantId: restaurant.id,
    tableLabel: table.label,
  });

  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard/orders");
  revalidatePath("/station");
  return { ok: true, message: `A waiter has been called to ${table.label}.` };
}

// ---------------------------------------------------------------- staff side

/**
 * Advance an order. Any active member may do this: the kitchen moves a ticket
 * to `preparing` and `ready`, the floor closes it as `completed`.
 *
 * Marking an order ready is the moment the waiter needs to know about, so it
 * also raises a pickup request unless one is already open for that order.
 */
export async function updateOrderStatusAction(
  orderId: string,
  status: string,
  reason = ""
): Promise<ActionState> {
  const membership = await getMembership();
  if (!membership || !moduleEnabled(membership.restaurant,"orders")) return fail("Orders are disabled for this account.");
  const context = await getMemberContext();
  if (!context.ok) return context.error;

  if (!ORDER_STATUSES.includes(status as OrderStatus)) return fail("Unknown status.");
  if (membership.restaurant.enabled_modules != null && !moduleEnabled(membership.restaurant,"tables") && ["accepted", "preparing", "ready"].includes(status)) {
    return fail("This business completes orders directly without preparation stages.");
  }

  const permission = statusPermission(status);
  if ((!permission || !context.permissions.includes(permission)) && !["owner", "manager"].includes(context.role)) return fail("You do not have permission for this action.");
  const supabase = createAdminSupabase();
  const { data: updated, error } = await supabase.rpc('change_fiscal_order', {
    p_actor: context.userId, p_restaurant: context.restaurantId, p_order: orderId,
    p_action: status === 'cancelled' ? 'void' : status, p_reason: reason,
  });

  if (error) return fail(error.message);
  if (!updated) return fail("That order is not on your board any more.");

  if (status === "ready" && updated.table_id && moduleEnabled(membership.restaurant,"service_calls")) {
    await raisePickup(context.restaurantId, updated.id, updated.order_number, updated.table_id, context.userId);
  } else {
    await publishEvent({
      id: `order.status:${updated.id}:${status}`,
      kind: "order.status",
      restaurantId: context.restaurantId,
      orderId: updated.id,
      orderNumber: updated.order_number,
    });
  }

  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  revalidatePath("/station");
  return done("Order updated.");
}

/** The kitchen asking a waiter to come and collect a finished order. */
export async function callWaiterForOrderAction(
  orderId: string,
  note?: string
): Promise<ActionState> {
  const membership = await getMembership();
  if (!membership || (!moduleEnabled(membership.restaurant,"orders") || !moduleEnabled(membership.restaurant,"service_calls"))) return fail("Service calls are disabled for this account.");
  const context = await getMemberContext();
  if (!context.ok) return context.error;

  if (!context.permissions.includes("orders.prepare")) return fail("You do not have permission for this action.");
  const admin = createAdminSupabase();
  const { data: order } = await admin
    .from("orders")
    .select("id, order_number, table_id")
    .eq("id", orderId)
    .eq("restaurant_id", context.restaurantId)
    .maybeSingle();

  if (!order) return fail("That order is not on your board any more.");

  const raised = await raisePickup(
    context.restaurantId,
    order.id,
    order.order_number,
    order.table_id,
    context.userId,
    note
  );

  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard/orders");
  revalidatePath("/station");
  return raised ? done("A waiter has been called.") : done("A waiter is already on the way.");
}

async function raisePickup(
  restaurantId: string,
  orderId: string,
  orderNumber: number,
  tableId: string | null,
  userId: string,
  note?: string
): Promise<boolean> {
  const admin = createAdminSupabase();

  const { data: existing } = await admin
    .from("waiter_requests")
    .select("id")
    .eq("order_id", orderId)
    .eq("status", "pending")
    .limit(1);

  let requestId = existing?.[0]?.id as string | undefined;

  if (!requestId) {
    const { data: created } = await admin
      .from("waiter_requests")
      .insert({
        restaurant_id: restaurantId,
        table_id: tableId,
        order_id: orderId,
        origin: "staff",
        created_by: userId,
        note: (note ?? "").trim().slice(0, 200) || null,
      })
      .select("id")
      .single();
    requestId = created?.id;
  }

  let label: string | null = null;
  if (tableId) {
    const { data: table } = await admin
      .from("restaurant_tables")
      .select("label")
      .eq("id", tableId)
      .maybeSingle();
    label = table?.label ?? null;
  }

  await publishEvent({
    id: `waiter:${requestId ?? `${orderId}-${Date.now()}`}`,
    kind: "waiter.pickup",
    restaurantId,
    orderId,
    orderNumber,
    tableLabel: label,
    note: note ?? null,
  });

  return !existing || existing.length === 0;
}

export async function resolveWaiterRequestAction(requestId: string): Promise<ActionState> {
  const membership = await getMembership();
  if (!membership || !moduleEnabled(membership.restaurant,"service_calls")) return fail("Service calls are disabled for this account.");
  const context = await getMemberContext();
  if (!context.ok) return context.error;

  if (!context.permissions.includes("calls.resolve")) return fail("You do not have permission for this action.");
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from("waiter_requests")
    .update({
      status: "handled",
      handled_at: new Date().toISOString(),
      handled_by: context.userId,
    })
    .eq("id", requestId)
    .eq("restaurant_id", context.restaurantId);

  if (error) return fail(error.message);

  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard/orders");
  revalidatePath("/station");
  return done("Marked as handled.");
}
