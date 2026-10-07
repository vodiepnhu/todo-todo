import { describe, expect, it } from "vitest";
import { categoryPalette } from "@/lib/category-colors";

describe("categoryPalette", () => {
  it("uses category-specific palettes and a neutral fallback", () => {
    expect(categoryPalette("Restaurant, Lunch").card).toContain("orange");
    expect(categoryPalette("Museum").card).toContain("violet");
    expect(categoryPalette("Unknown").card).toContain("slate");
  });
});
