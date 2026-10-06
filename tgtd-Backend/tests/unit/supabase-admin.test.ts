import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdminClient } from "../../src/platform/supabase/admin";

describe("Supabase admin client guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects missing service-role configuration", () => {
    vi.stubEnv("SUPABASE_INTERNAL_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");

    expect(() => createAdminClient()).toThrow(
      "Service role env vars are not configured",
    );
  });

  it("rejects placeholder service-role key", () => {
    vi.stubEnv("SUPABASE_INTERNAL_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_SECRET_KEY", "your-service-role-key");

    expect(() => createAdminClient()).toThrow(
      "SUPABASE_SECRET_KEY is still a placeholder",
    );
  });
});
