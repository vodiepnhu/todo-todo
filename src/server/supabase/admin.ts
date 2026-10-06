import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerUrl } from "@/server/supabase/config";

/** Server-only service-role client. Never import from browser modules. */
export function createAdminClient() {
  const url = getSupabaseServerUrl();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Service role env vars are not configured");
  }
  if (key === "your-service-role-key") {
    throw new Error("SUPABASE_SECRET_KEY is still a placeholder");
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
