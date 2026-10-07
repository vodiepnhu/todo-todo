import { describe, expect, it } from "vitest";
import {
  LOCAL_DEMO_EMAIL,
  googleAuthRedirectUrl,
  resolveLoginEmail,
  safeNextPath,
} from "@/features/auth/domain/login";
import { evaluatePassword } from "@/features/auth/domain/password-policy";

describe("auth domain", () => {
  it("maps demo alias only when local demo mode is enabled", () => {
    expect(resolveLoginEmail("demo", true)).toBe(LOCAL_DEMO_EMAIL);
    expect(resolveLoginEmail("demo", false)).toBe("demo");
    expect(resolveLoginEmail("demo@local.test", false)).toBe("demo@local.test");
  });

  it("matches seeded local demo account", () => {
    expect(LOCAL_DEMO_EMAIL).toBe("demo@local.test");
    expect(resolveLoginEmail("demo", true)).toBe("demo@local.test");
  });

  it("keeps next redirects on the local application", () => {
    expect(safeNextPath("/projects")).toBe("/projects");
    expect(safeNextPath("/app")).toBe("/projects");
    expect(safeNextPath("https://example.com")).toBe("/projects");
    expect(safeNextPath("//example.com")).toBe("/projects");
  });

  it("preserves signup password policy", () => {
    expect(evaluatePassword("short").ok).toBe(false);
    expect(evaluatePassword("Good-password-123").ok).toBe(true);
  });

  it("uses local callback for Google auth", () => {
    expect(googleAuthRedirectUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/auth/callback?next=%2Fprojects",
    );
  });
});
