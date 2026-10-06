import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerUrl } from "./config";

/** Service-role client — bypasses RLS. Server-only. Never import in client components. */
export function createAdminClient() {
  const url = getSupabaseServerUrl();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Service role env vars are not configured");
  }
  if (key === "your-service-role-key") {
    throw new Error(
      "SUPABASE_SECRET_KEY is still a placeholder. Set it from `npx supabase status` or run the Docker stack with .env.docker.",
    );
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
