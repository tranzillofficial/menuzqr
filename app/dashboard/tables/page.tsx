import type { Metadata } from "next";
import { requireRestaurant } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/Shell";
import { getT } from "@/lib/i18n/server";
import { TablesManager } from "@/components/dashboard/TablesManager";
import type { RestaurantTable } from "@/lib/types";

export const metadata: Metadata = { title: "Tables" };

export default async function TablesPage() {
  const [restaurant, supabase, t] = await Promise.all([
    requireRestaurant(),
    createServerSupabase(),
    getT(),
  ]);

  const { data: tables } = await supabase
    .from("restaurant_tables")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t("tables.title")}
        description={t("tables.sub")}
      />
      <TablesManager tables={(tables ?? []) as RestaurantTable[]} />
    </div>
  );
}
