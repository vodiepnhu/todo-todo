import { describe, expect, it } from "vitest";
import {
  coerceEventType,
  coerceItemType,
  coerceSubtype,
  isDueSoon,
  itemHasPlace,
} from "@/lib/items/activity";

describe("activity coerce", () => {
  it("coerces TODO/TOGO to ACTIVITY", () => {
    expect(coerceItemType("TODO")).toBe("ACTIVITY");
    expect(coerceItemType("TOGO")).toBe("ACTIVITY");
    expect(coerceItemType("ACTIVITY")).toBe("ACTIVITY");
  });

  it("always coerces subtype to TASK", () => {
    expect(coerceSubtype("VISIT")).toBe("TASK");
    expect(coerceSubtype("TASK_AT_PLACE")).toBe("TASK");
  });

  it("maps VISITED to COMPLETED", () => {
    expect(coerceEventType("VISITED")).toBe("COMPLETED");
    expect(coerceEventType("COMPLETED")).toBe("COMPLETED");
  });

  it("detects place via item_places or maps URL", () => {
    expect(itemHasPlace({ item_places: [{ place_id: "p1" }] })).toBe(true);
    expect(
      itemHasPlace({
        source_text: "see https://maps.google.com/?q=Bondi",
      }),
    ).toBe(true);
    expect(itemHasPlace({ description: "no place" })).toBe(false);
  });

  it("isDueSoon includes overdue and next 7 days", () => {
    const now = new Date("2026-09-24T12:00:00Z");
    expect(isDueSoon("2026-09-20T00:00:00Z", now)).toBe(true);
    expect(isDueSoon("2026-09-30T00:00:00Z", now)).toBe(true);
    expect(isDueSoon("2026-10-10T00:00:00Z", now)).toBe(false);
    expect(isDueSoon(null, now)).toBe(false);
  });
});
