"use server";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/**
 * Stores a browser's push endpoint against the signed-in user.
 *
 * Written with the service role after the session is verified here: the same
 * endpoint can legitimately move between accounts (a shared tablet where the
 * waiter signs out and the chef signs in), so the old row has to go even when
 * it belongs to someone else.
 */
export async function savePushSubscriptionAction(
  subscription: PushSubscriptionInput,
  userAgent: string
): Promise<{ ok: boolean; message?: string }> {
  const endpoint = subscription?.endpoint?.trim();
  const p256dh = subscription?.keys?.p256dh?.trim();
  const auth = subscription?.keys?.auth?.trim();

  if (!endpoint || !p256dh || !auth) return { ok: false, message: "Invalid subscription." };
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000) {
    return { ok: false, message: "Invalid subscription." };
  }
  // base64url key material, as the Push API hands it over.
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{8,100}$/.test(auth)) {
    return { ok: false, message: "Invalid subscription." };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "You need to sign in first." };

  const { data: member } = await supabase
    .from("restaurant_members")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const admin = createAdminSupabase();
  await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);

  const { error } = await admin.from("push_subscriptions").insert({
    user_id: user.id,
    restaurant_id: member?.restaurant_id ?? null,
    endpoint,
    p256dh,
    auth,
    user_agent: userAgent.slice(0, 250) || null,
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function removePushSubscriptionAction(
  endpoint: string
): Promise<{ ok: boolean }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  await createAdminSupabase()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);

  return { ok: true };
}
