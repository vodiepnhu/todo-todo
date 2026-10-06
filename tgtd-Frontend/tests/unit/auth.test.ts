import { describe, expect, it } from "vitest";
import {
  LOCAL_DEMO_EMAIL,
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

  it("keeps next redirects on the local application", () => {
    expect(safeNextPath("/app")).toBe("/app");
    expect(safeNextPath("https://example.com")).toBe("/app");
    expect(safeNextPath("//example.com")).toBe("/app");
  });

  it("preserves signup password policy", () => {
    expect(evaluatePassword("short").ok).toBe(false);
    expect(evaluatePassword("Good-password-123").ok).toBe(true);
  });
});
