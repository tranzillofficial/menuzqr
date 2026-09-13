"use server";

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
      .select("user_id")
      .eq("restaurant_id", restaurantId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    return data ? user.id : null;
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
 * the database — the client's prices are never trusted.
 */
export async function placeOrderAction(
  slug: string,
  tableToken: string,
  lines: CartLine[],
  orderNote: string,
  sessionId: string
): Promise<PlaceOrderResult> {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false, message: "Your cart is empty." };
  }
  if (lines.length > MAX_LINES) {
    return { ok: false, message: "Too many items in one order." };
  }

  const supabase = createAdminSupabase();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, status, ordering_enabled, currency, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!restaurant) return { ok: false, message: "Restaurant not found." };
  if (restaurant.status !== "active") {
    return { ok: false, message: "This menu is not accepting orders right now." };
  }

  // When the owner turns guest ordering off, the QR code still works for the
  // restaurant's own staff: a waiter scans the table and takes the order.
  const staffId = await memberOf(restaurant.id);

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

  const variantIds = [...new Set(lines.map((l) => l.variantId))];
  const { data: variants } = await supabase
    .from("product_variants")
    .select("id, name, price, is_active, product_id, products(id, name, is_active, restaurant_id)")
    .eq("restaurant_id", restaurant.id)
    .in("id", variantIds);

  const variantMap = new Map(
    (variants ?? [])
      .filter((v) => {
        const product = v.products as unknown as
          | { is_active: boolean; restaurant_id: string; name: string }
          | null;
        return v.is_active && product?.is_active && product.restaurant_id === restaurant.id;
      })
      .map((v) => [v.id, v])
  );

  const itemRows: {
    product_id: string;
    variant_id: string;
    product_name: string;
    variant_name: string;
    unit_price: number;
    quantity: number;
    note: string | null;
    line_total: number;
  }[] = [];

  let total = 0;

  for (const line of lines) {
    const variant = variantMap.get(line.variantId);
    if (!variant) {
      return { ok: false, message: "One of the items is no longer available. Please refresh the menu." };
    }
    const quantity = Math.min(Math.max(Math.floor(Number(line.quantity) || 0), 1), 99);
    const unitPrice = Number(variant.price) || 0;
    const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
    total += lineTotal;

    const product = variant.products as unknown as { id: string; name: string };

    itemRows.push({
      product_id: product.id,
      variant_id: variant.id,
      product_name: product.name,
      variant_name: variant.name,
      unit_price: unitPrice,
      quantity,
      note: (line.note ?? "").trim().slice(0, 200) || null,
      line_total: lineTotal,
    });
  }

  total = Math.round(total * 100) / 100;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      restaurant_id: restaurant.id,
      table_id: table.id,
      session_id: sessionId.slice(0, 64) || null,
      note: orderNote.trim().slice(0, 400) || null,
      total,
      currency: restaurant.currency,
      placed_by: staffId,
    })
    .select("id, order_number, public_token")
    .single();

  if (orderError || !order) {
    return { ok: false, message: "We could not send your order. Please try again." };
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    itemRows.map((row) => ({ ...row, order_id: order.id, restaurant_id: restaurant.id }))
  );

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return { ok: false, message: "We could not send your order. Please try again." };
  }

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

export async function callWaiterAction(
  slug: string,
  tableToken: string
): Promise<{ ok: boolean; message: string }> {
  const supabase = createAdminSupabase();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, status, waiter_calls_enabled")
    .eq("slug", slug)
    .maybeSingle();

  if (!restaurant || restaurant.status !== "active") {
    return { ok: false, message: "This menu is not available right now." };
  }

  // Same rule as ordering: the restaurant's own staff can still use the QR
  // code when the owner has switched guest calls off.
  const staffId = await memberOf(restaurant.id);

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
  status: string
): Promise<ActionState> {
  const context = await getMemberContext();
  if (!context.ok) return context.error;

  if (!ORDER_STATUSES.includes(status as OrderStatus)) return fail("Unknown status.");

  const supabase = await createServerSupabase();
  const { data: updated, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .eq("restaurant_id", context.restaurantId)
    .select("id, order_number, table_id, status")
    .maybeSingle();

  if (error) return fail(error.message);
  if (!updated) return fail("That order is not on your board any more.");

  if (status === "ready") {
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
  const context = await getMemberContext();
  if (!context.ok) return context.error;

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
  const context = await getMemberContext();
  if (!context.ok) return context.error;

  const supabase = await createServerSupabase();
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

  revalidatePath("/dashboard/orders");
  revalidatePath("/station");
  return done("Marked as handled.");
}
