import "server-only";

import webpush from "web-push";
import { createAdminSupabase } from "./supabase/admin";
import type { PushSubscriptionRow } from "./types";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  kind: string;
};

let configured: boolean | null = null;

/**
 * Web push is optional. Without VAPID keys the app still works — the dashboard
 * gets live updates while it is open — it simply cannot wake a phone whose
 * screen is off. So every helper here fails soft.
 */
export function pushConfigured(): boolean {
  if (configured !== null) return configured;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@menuzqr.com";

  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch {
    configured = false;
  }
  return configured;
}

/**
 * Sends one notification to every device registered by these users.
 *
 * Endpoints that the push service has retired (404/410) are deleted, so a
 * restaurant that reinstalls the app does not accumulate dead subscriptions.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  if (!pushConfigured() || userIds.length === 0) return 0;

  const supabase = createAdminSupabase();
  const { data } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, restaurant_id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  const subs = (data ?? []) as PushSubscriptionRow[];
  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 120, headers: { Urgency: "high" } }
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(sub.id);
      }
    })
  );

  if (dead.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", dead);
  }

  return sent;
}
