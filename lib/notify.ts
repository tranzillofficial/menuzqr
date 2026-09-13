import "server-only";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { createAdminSupabase } from "./supabase/admin";
import { broadcastEvent } from "./realtime-server";
import { sendPushToUsers } from "./push";
import { EVENT_AUDIENCE, describeEvent, eventLink, type LiveEvent, type LiveEventKind } from "./events";
import { createTranslator, isLocale } from "./i18n";
import type { MemberRole } from "./constants";

type EventInput = Omit<LiveEvent, "id" | "at"> & { id?: string; at?: string };

/**
 * Announces something that just happened in a restaurant.
 *
 * Three things go out, in order of how quickly they land:
 *  1. a Realtime broadcast, for every screen that is currently open;
 *  2. a web push, for phones whose screen is off or whose tab is closed;
 *  3. nothing else — the rows themselves are the source of truth, and every
 *     screen re-reads them when it wakes up.
 *
 * Never throws. A failed notification must not roll back a real order.
 */
export async function publishEvent(input: EventInput): Promise<void> {
  const event: LiveEvent = {
    ...input,
    id: input.id ?? randomUUID(),
    at: input.at ?? new Date().toISOString(),
  };

  const work = Promise.allSettled([broadcastEvent(event), pushToAudience(event)]).then(
    () => undefined,
    () => undefined
  );

  // Run it after the response is sent so a guest tapping "Send order" is not
  // waiting on a push service. Outside a request scope `after` throws, and we
  // simply wait for the work instead.
  try {
    after(work);
  } catch {
    await work;
  }
}

async function pushToAudience(event: LiveEvent) {
  const roles = EVENT_AUDIENCE[event.kind as LiveEventKind] ?? [];
  if (roles.length === 0) return;

  const supabase = createAdminSupabase();

  const [{ data: members }, { data: restaurant }] = await Promise.all([
    supabase
      .from("restaurant_members")
      .select("user_id, role")
      .eq("restaurant_id", event.restaurantId)
      .eq("is_active", true)
      .in("role", roles),
    supabase
      .from("restaurants")
      .select("language")
      .eq("id", event.restaurantId)
      .maybeSingle(),
  ]);

  const recipients = members ?? [];
  if (recipients.length === 0) return;

  const language = restaurant?.language;
  const t = createTranslator(isLocale(language) ? language : "en");
  const { title, body, emoji } = describeEvent(event, t);

  // Managers and staff land on different screens, so the click-through URL is
  // resolved per role and the send is grouped by it.
  const byLink = new Map<string, string[]>();
  for (const member of recipients) {
    const link = eventLink(event.kind, member.role as MemberRole);
    const list = byLink.get(link) ?? [];
    list.push(member.user_id);
    byLink.set(link, list);
  }

  await Promise.allSettled(
    [...byLink.entries()].map(([url, userIds]) =>
      sendPushToUsers(userIds, {
        title: `${emoji} ${title}`,
        body,
        url,
        tag: `${event.kind}:${event.orderId ?? event.id}`,
        kind: event.kind,
      })
    )
  );
}
