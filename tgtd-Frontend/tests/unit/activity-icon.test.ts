import { describe, expect, it } from "vitest";
import {
  getActivityIconGlyph,
  getActivityIconName,
} from "@/components/items/activity-icon";

describe("getActivityIconName", () => {
  it.each([
    ["Bondi Beach swim", "waves"],
    ["Take photos at sunset", "camera"],
    ["Try a coffee and pastry", "coffee"],
    ["Museum visit", "landmark"],
    ["Shopping for groceries", "shopping-bag"],
    ["Hiking trail", "footprints"],
  ])("maps %s to %s", (label, icon) => {
    expect(getActivityIconName(label)).toBe(icon);
  });

  it("matches Vietnamese activity text", () => {
    expect(getActivityIconName("Bơi ở biển và chụp ảnh")).toBe("waves");
    expect(getActivityIconName("Cà phê cuối tuần")).toBe("coffee");
  });

  it("uses category words when title is generic", () => {
    expect(getActivityIconName("NATURE · Weekend plan")).toBe("tree-pine");
  });

  it("falls back for unknown activity text", () => {
    expect(getActivityIconName("Something new")).toBe("sparkles");
  });

  it("returns colorful glyphs for the activity type", () => {
    expect(getActivityIconGlyph("Coffee in Koto City")).toBe("☕");
    expect(getActivityIconGlyph("Visit a museum")).toBe("🏛️");
    expect(getActivityIconGlyph("Something new")).toBe("✨");
  });
});
