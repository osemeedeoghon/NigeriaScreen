import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseConfig } from "./config";

/**
 * A client with no cookies and no session: it always acts as an anonymous
 * visitor. Use it only for public, non-personal data that may be cached and
 * shared between users.
 */
export function createPublicSupabaseClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createClient<Database>(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
