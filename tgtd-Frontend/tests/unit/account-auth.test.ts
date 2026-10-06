import { describe, expect, it } from "vitest";
import {
  formatSignInMethods,
  hasEmailPasswordProvider,
} from "@/lib/auth/account";

describe("hasEmailPasswordProvider", () => {
  it("true when email identity present", () => {
    expect(
      hasEmailPasswordProvider([{ provider: "email" }, { provider: "google" }]),
    ).toBe(true);
  });

  it("false for OAuth-only or empty", () => {
    expect(hasEmailPasswordProvider([{ provider: "google" }])).toBe(false);
    expect(hasEmailPasswordProvider([])).toBe(false);
    expect(hasEmailPasswordProvider(null)).toBe(false);
  });
});

describe("formatSignInMethods", () => {
  it("lists unique providers", () => {
    expect(
      formatSignInMethods([{ provider: "email" }, { provider: "google" }]),
    ).toBe("Email · Google");
  });
});
