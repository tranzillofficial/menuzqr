"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./env";

let cached: ReturnType<typeof createBrowserClient> | null = null;

/** Browser Supabase client. Always subject to Row Level Security. */
export function createClient() {
  if (!cached) {
    cached = createBrowserClient(supabaseUrl(), supabasePublishableKey());
  }
  return cached;
}
