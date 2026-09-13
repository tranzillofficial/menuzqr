import "server-only";

import { BROADCAST_EVENT, restaurantTopic, type LiveEvent } from "./events";
import { supabaseServiceKey, supabaseUrl } from "./supabase/env";

/**
 * Pushes an event straight into Supabase Realtime as a broadcast message.
 *
 * This is the second delivery path, next to `postgres_changes`. Change-data
 * capture depends on the publication being right *and* on Realtime being able
 * to evaluate the row's RLS policy for every listener — two things that fail
 * silently when they are misconfigured. A broadcast is sent by us, explicitly,
 * so an open dashboard still lights up while that is being sorted out.
 *
 * Failures are swallowed: a notification must never lose a customer's order.
 */
export async function broadcastEvent(event: LiveEvent): Promise<boolean> {
  let url: string;
  let key: string;
  try {
    url = supabaseUrl().replace(/\/$/, "");
    key = supabaseServiceKey();
  } catch {
    return false;
  }

  try {
    const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: restaurantTopic(event.restaurantId),
            event: BROADCAST_EVENT,
            payload: event,
            private: true,
          },
        ],
      }),
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}
