import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSupabaseBrowserUrl,
  getSupabaseCookieName,
  getSupabaseServerUrl,
} from "@/server/supabase/config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase foundation configuration", () => {
  it("derives the shared cookie name from the browser host", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    expect(getSupabaseCookieName()).toBe("sb-localhost-auth-token");
  });

  it("prefers the internal server URL while preserving the browser URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:8000");
    vi.stubEnv("SUPABASE_INTERNAL_URL", "http://kong:8000");
    expect(getSupabaseBrowserUrl()).toBe("http://localhost:8000");
    expect(getSupabaseServerUrl()).toBe("http://kong:8000");
  });
});
