import { describe, expect, it } from "vitest";
import { applyHomeModeBias } from "@/lib/home-chat-mode";

describe("applyHomeModeBias", () => {
  it("adds Ask bias", () => {
    const out = applyHomeModeBias("cafe near me", "ask");
    expect(out).toContain("cafe near me");
    expect(out).toMatch(/Ask mode/i);
    expect(out).toMatch(/recommend/i);
  });

  it("adds Add bias", () => {
    const out = applyHomeModeBias("Bondi Saturday", "add");
    expect(out).toContain("Bondi Saturday");
    expect(out).toMatch(/Add mode/i);
    expect(out).toMatch(/CREATE_ITEM/i);
  });
});
