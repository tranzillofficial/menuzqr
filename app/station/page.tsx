import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";
import { StationBoard } from "@/components/station/StationBoard";
import { requireStation } from "@/lib/membership";
import { createServerSupabase } from "@/lib/supabase/server";
import type { OrderWithDetails, WaiterRequest } from "@/lib/types";

// Service is live state. never serve this from a cache.
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

  const locale = await getLocale();
  const { data: tables } = membership.permissions.includes("orders.create") ? await supabase.from("restaurant_tables").select("id, label, qr_token").eq("restaurant_id", membership.restaurant.id).eq("is_active", true).order("label") : { data: [] };

  return (
    <div className="space-y-6">
      {membership.permissions.includes("orders.create") && <section className="rounded-2xl border border-white/15 p-4"><h2 className="mb-3 font-semibold">{locale === "ar" ? "طلب جديد لترابيزة" : "New table order"}</h2><div className="flex flex-wrap gap-2">{(tables ?? []).map(table => <Link className="rounded-xl bg-brand-600 px-4 py-3 text-sm" key={table.id} href={`/${membership.restaurant.slug}/menu?table=${table.qr_token}`}>{table.label}</Link>)}{!tables?.length && <p className="text-sm text-white/60">{locale === "ar" ? "اطلب من صاحب المطعم يضيف الترابيزات الأول." : "Ask the owner to add tables first."}</p>}</div></section>}
    <StationBoard
      permissions={membership.permissions}
      orders={(orders ?? []) as OrderWithDetails[]}
      calls={calls as WaiterRequest[]}
      currency={membership.restaurant.currency}
    />
    </div>
  );
}
