"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Keeps a server-rendered page in sync with Supabase Realtime changes. */
export function RealtimeRefresh({ restaurantId }: { restaurantId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // The dashboard shell is listening too, so a single insert can arrive here
    // and there at the same moment. Coalesce bursts into one refresh.
    const refresh = () => {
      if (!live) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (live) router.refresh();
      }, 250);
    };

    // A unique topic per mount: `supabase.channel(name)` reuses an existing
    // channel for the same topic, and `removeChannel` resolves asynchronously,
    // so a stable name breaks under React StrictMode's double mount.
    const channel = supabase
      .channel(`orders-page-${restaurantId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "waiter_requests",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        refresh
      )
      .subscribe();

    return () => {
      live = false;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, router]);

  return null;
}
