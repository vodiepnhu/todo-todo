import { describe, expect, it } from "vitest";
import {
  parseRagMetaFilters,
  reciprocalRankFusion,
} from "@/lib/rag/hybrid";

describe("reciprocalRankFusion", () => {
  it("boosts items appearing in multiple lists", () => {
    const a = [
      { id: "1", label: "a" },
      { id: "2", label: "b" },
    ];
    const b = [
      { id: "2", label: "b" },
      { id: "3", label: "c" },
    ];
    const fused = reciprocalRankFusion([a, b]);
    expect(fused[0]!.id).toBe("2");
  });
});

describe("parseRagMetaFilters", () => {
  it("keeps itemType null and detects beach tag", () => {
    expect(parseRagMetaFilters("beach places near me")).toEqual({
      itemType: null,
      tag: "beach",
    });
  });

  it("does not filter by legacy TODO keyword", () => {
    expect(parseRagMetaFilters("todo buy milk")).toMatchObject({
      itemType: null,
    });
  });
});
