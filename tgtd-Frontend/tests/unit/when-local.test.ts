import { describe, expect, it } from "vitest";
import {
  formatWhenLabel,
  isoToWhenParts,
  mergeWhenParts,
  whenPartsToIso,
} from "@/lib/when-local";

describe("when-local", () => {
  it("round-trips Sydney date+time through ISO", () => {
    const iso = whenPartsToIso({ date: "2026-09-24", time: "09:00" });
    expect(iso).toBeTruthy();
    const parts = isoToWhenParts(iso!);
    expect(parts).toEqual({ date: "2026-09-24", time: "09:00" });
  });

  it("formats a readable label", () => {
    const iso = whenPartsToIso({ date: "2026-09-24", time: "09:00" })!;
    expect(formatWhenLabel(iso)).toMatch(/Sep/);
    expect(formatWhenLabel(null)).toBe("Not set");
  });

  it("mergeWhenParts defaults time to 09:00", () => {
    expect(mergeWhenParts(null, { date: "2026-09-25" })).toEqual({
      date: "2026-09-25",
      time: "09:00",
    });
  });
});
