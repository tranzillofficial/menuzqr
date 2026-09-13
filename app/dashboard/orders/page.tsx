import type { Metadata } from "next";
import { requireRestaurant } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/Shell";
import { OrdersBoard } from "@/components/dashboard/OrdersBoard";
import { RealtimeRefresh } from "@/components/dashboard/RealtimeRefresh";
import type { OrderWithDetails, WaiterRequest } from "@/lib/types";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const restaurant = await requireRestaurant();
  const supabase = await createServerSupabase();

  const [{ data: orders }, { data: waiters }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, order_items(*), restaurant_tables(id, label)")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("waiter_requests")
      .select("*, restaurant_tables(id, label)")
      .eq("restaurant_id", restaurant.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <RealtimeRefresh restaurantId={restaurant.id} />
      <PageHeader
        title="Orders"
        description="Live table orders and waiter calls. This page updates itself."
      />
      <OrdersBoard
        orders={(orders ?? []) as OrderWithDetails[]}
        waiterRequests={(waiters ?? []) as WaiterRequest[]}
        currency={restaurant.currency}
      />
    </div>
  );
}
