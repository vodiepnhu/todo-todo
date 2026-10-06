export function getSupabaseBrowserUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

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

export function getSupabaseCookieName() {
  const browserUrl = getSupabaseBrowserUrl() || "http://localhost:8000";
  try {
    const host = new URL(browserUrl).hostname.split(".")[0] || "localhost";
    return `sb-${host}-auth-token`;
  } catch {
    return "sb-localhost-auth-token";
  }
}
