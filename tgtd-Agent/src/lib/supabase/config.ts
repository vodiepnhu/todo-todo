/** Browser-facing Supabase URL (must be reachable from the user's browser). */
export function getSupabaseBrowserUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

/**
 * Server-side Supabase URL.
 * In Docker, NEXT_PUBLIC_* points at localhost:8000 (host), which is unreachable
 * from inside the web container — use SUPABASE_INTERNAL_URL=http://kong:8000.
 */
export function getSupabaseServerUrl() {
  return (
    process.env.SUPABASE_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  );
}

export function getSupabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  );
}

/**
 * Cookie storage key must match between browser + server clients.
 * Derived from the *browser* URL host (localhost), not the internal Docker host (kong).
 */
export function getSupabaseCookieName() {
  const browserUrl = getSupabaseBrowserUrl() || "http://localhost:8000";
  try {
    const host = new URL(browserUrl).hostname.split(".")[0] || "localhost";
    return `sb-${host}-auth-token`;
  } catch {
    return "sb-localhost-auth-token";
  }
}
