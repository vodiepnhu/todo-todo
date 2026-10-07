import { describe, expect, it } from "vitest";
import { validatePasswordReset } from "@/features/auth/domain/password-reset";

describe("password reset validation", () => {
  it("requires a valid password and matching confirmation", () => {
    expect(validatePasswordReset("short", "short")).toBe(
      "Use at least 8 characters",
    );
    expect(validatePasswordReset("Str0ng!Password", "Different!123")).toBe(
      "Passwords do not match",
    );
    expect(validatePasswordReset("Str0ng!Password", "Str0ng!Password")).toBe(
      null,
    );
  });
});
