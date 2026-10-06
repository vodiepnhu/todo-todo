import { createBrowserClient } from "@supabase/ssr";
import {
  getSupabaseAnonKey,
  getSupabaseBrowserUrl,
  getSupabaseCookieName,
} from "@/server/supabase/config";

export function isSupabaseConfigured() {
  const url = getSupabaseBrowserUrl();
  const key = getSupabaseAnonKey();
  return Boolean(url && key && !key.includes("your-anon") && !url.includes("your-"));
}

export function createClient() {
  const url = getSupabaseBrowserUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local",
    );
  }

  return createBrowserClient(url, key, {
    cookieOptions: { name: getSupabaseCookieName() },
  });
}
