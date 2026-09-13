import "server-only";

import { createClient } from "@supabase/supabase-js";
import { supabaseServiceKey, supabaseUrl } from "./env";

/**
 * Service-role client. BYPASSES Row Level Security.
 *
 * Only use it where a request has no authenticated user but must still be
 * trusted (public menu ordering, waiter calls) or for verified admin work —
 * and always validate ownership/activation yourself before writing.
 */
export function createAdminSupabase() {
  return createClient(supabaseUrl(), supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
