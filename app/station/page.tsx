import { StationBoard } from "@/components/station/StationBoard";
import { requireStation } from "@/lib/membership";
import { createServerSupabase } from "@/lib/supabase/server";
import type { OrderWithDetails, WaiterRequest } from "@/lib/types";

// Service is live state — never serve this from a cache.
export const dynamic = "force-dynamic";

const OPEN_STATUSES = ["pending", "accepted", "preparing", "ready"];

export default async function StationPage() {
  const membership = await requireStation();
  const supabase = await createServerSupabase();

  const [{ data: orders }, { data: rawCalls }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, order_items(*), restaurant_tables(id, label)")
      .eq("restaurant_id", membership.restaurant.id)
      .in("status", OPEN_STATUSES)
      .order("created_at", { ascending: true })
      .limit(80),
    supabase
      .from("waiter_requests")
      .select("*, restaurant_tables(id, label)")
      .eq("restaurant_id", membership.restaurant.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(40),
  ]);

  // The order number on a kitchen call is looked up from the orders already
  // loaded above, so the board does not depend on a PostgREST embed.
  const orderNumberById = new Map(
    (orders ?? []).map((order) => [order.id as string, order.order_number as number])
  );

  const calls = (rawCalls ?? []).map((call) => ({
    ...call,
    orders: call.order_id
      ? { id: call.order_id as string, order_number: orderNumberById.get(call.order_id) ?? 0 }
      : null,
  }));

  return (
    <StationBoard
      role={membership.role}
      orders={(orders ?? []) as OrderWithDetails[]}
      calls={calls as WaiterRequest[]}
      currency={membership.restaurant.currency}
    />
  );
}
