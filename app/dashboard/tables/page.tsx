import type { Metadata } from "next";
import { requireRestaurant } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/Shell";
import { TablesManager } from "@/components/dashboard/TablesManager";
import type { RestaurantTable } from "@/lib/types";

export const metadata: Metadata = { title: "Tables" };

export default async function TablesPage() {
  const restaurant = await requireRestaurant();
  const supabase = await createServerSupabase();

  const { data: tables } = await supabase
    .from("restaurant_tables")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Tables"
        description="Each table gets a private QR code so orders and waiter calls arrive with the right table number."
      />
      <TablesManager tables={(tables ?? []) as RestaurantTable[]} />
    </div>
  );
}
