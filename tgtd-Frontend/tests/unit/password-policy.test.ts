import { describe, expect, it } from "vitest";
import {
  evaluatePassword,
  isPasswordAcceptable,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from "@/lib/auth/password-policy";

describe("password-policy", () => {
  it("rejects too short", () => {
    const r = evaluatePassword("Ab1!");
    expect(r.ok).toBe(false);
    expect(r.checks.minLength).toBe(false);
  });

  it("rejects missing character classes", () => {
    expect(evaluatePassword("abcdefgh").ok).toBe(false);
    expect(evaluatePassword("ABCDEFGH").ok).toBe(false);
    expect(evaluatePassword("ABCD1234").checks.hasLower).toBe(false);
    expect(evaluatePassword("abcd1234").checks.hasUpper).toBe(false);
    expect(evaluatePassword("Abcdefgh").checks.hasDigit).toBe(false);
    expect(evaluatePassword("Abcdefg1").checks.hasSymbol).toBe(false);
  });

  it("accepts strong modern password", () => {
    const r = evaluatePassword("Str0ng!Password");
    expect(r.ok).toBe(true);
    expect(isPasswordAcceptable("Str0ng!Password")).toBe(true);
    expect(r.strength).toBe("strong");
  });

  it("flags common passwords", () => {
    const r = evaluatePassword("Password1!");
    expect(r.checks.notCommon).toBe(false);
    expect(r.ok).toBe(false);
  });

  it("enforces max length", () => {
    const long = `Aa1!${"x".repeat(PASSWORD_MAX)}`;
    expect(evaluatePassword(long).checks.maxLength).toBe(false);
  });

  it("exposes min constant of at least 8", () => {
    expect(PASSWORD_MIN).toBeGreaterThanOrEqual(8);
  });
});
