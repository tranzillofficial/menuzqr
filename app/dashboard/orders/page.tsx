import { activeOrders } from "@/lib/order-data";
import { InvoiceExport } from "@/components/dashboard/InvoiceExport";
import type { Metadata } from "next";
import { requireRestaurant } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/Shell";
import { getT } from "@/lib/i18n/server";
import { OrdersBoard } from "@/components/dashboard/OrdersBoard";
import type { OrderWithDetails, WaiterRequest } from "@/lib/types";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const [restaurant, supabase, t] = await Promise.all([
    requireRestaurant(),
    createServerSupabase(),
    getT(),
  ]);

  const [active, { data: orders,error:orderError }, { data: waiters,error:waiterError }] = await Promise.all([
    activeOrders(restaurant.id),
    supabase
      .from("orders")
      .select("*, order_items(*), restaurant_tables(id, label)")
      .eq("restaurant_id", restaurant.id)
      .in("status", ["completed","cancelled"])
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("waiter_requests")
      .select("*, restaurant_tables(id, label)")
      .eq("restaurant_id", restaurant.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
  ]);

  if(orderError||waiterError)throw new Error("Could not load orders");
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t("orders.title")}
        description={t("orders.sub")}
      />
      <InvoiceExport />
      <OrdersBoard
        orders={[...active,...(orders??[]) as OrderWithDetails[]]}
        waiterRequests={(waiters ?? []) as WaiterRequest[]}
        currency={restaurant.currency}
      />
    </div>
  );
}
