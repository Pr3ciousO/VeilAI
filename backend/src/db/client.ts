import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";

let client: SupabaseClient | null = null;

/**
 * Server-side Supabase client using the service-role key.
 * NEVER expose this key or client to the browser — the frontend uses the anon key.
 */
export function db(): SupabaseClient {
  if (client) return client;
  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    throw new Error(
      "Supabase not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  client = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false },
  });
  return client;
}

/** True when Supabase env is present (lets routes degrade gracefully in dev). */
export function dbConfigured(): boolean {
  return Boolean(config.supabaseUrl && config.supabaseServiceKey);
}
