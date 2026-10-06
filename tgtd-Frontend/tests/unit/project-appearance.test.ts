import { describe, expect, it } from "vitest";
import {
  PROJECT_COLOR_PRESETS,
  PROJECT_ICON_PRESETS,
  normalizeHex,
} from "@/lib/project-appearance";

describe("normalizeHex", () => {
  it("lowercases and keeps #rrggbb", () => {
    expect(normalizeHex("#0F766E")).toBe("#0f766e");
  });

  it("adds missing hash", () => {
    expect(normalizeHex("0f766e")).toBe("#0f766e");
  });

  it("expands 3-digit hex", () => {
    expect(normalizeHex("#abc")).toBe("#aabbcc");
  });

  it("returns null for empty or garbage", () => {
    expect(normalizeHex("")).toBeNull();
    expect(normalizeHex("   ")).toBeNull();
    expect(normalizeHex(null)).toBeNull();
    expect(normalizeHex("not-a-color")).toBeNull();
    expect(normalizeHex("#gg0000")).toBeNull();
  });
});

describe("presets", () => {
  it("exposes 24 icons and 10 colors", () => {
    expect(PROJECT_ICON_PRESETS).toHaveLength(24);
    expect(PROJECT_COLOR_PRESETS).toHaveLength(10);
    for (const c of PROJECT_COLOR_PRESETS) {
      expect(normalizeHex(c)).toBe(c);
    }
  });
});
