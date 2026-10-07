import { describe, expect, it } from "vitest";
import {
  filterHistoryEvents,
  historyCategories,
  historyCategory,
  type HistoryEvent,
} from "@/lib/history-filters";

function event(
  id: string,
  item: HistoryEvent["items"],
): HistoryEvent {
  return {
    id,
    workspace_id: "w1",
    item_id: id,
    event_type: "COMPLETED",
    occurred_at: "2026-10-08T00:00:00Z",
    ended_at: null,
    time_precision: "DATE_ONLY",
    actual_duration_min: null,
    place_id: null,
    note: null,
    recorded_by: "u1",
    created_at: "2026-10-08T00:00:00Z",
    items: item,
  };
}

describe("history filters", () => {
  it("prefers custom category label and falls back to category", () => {
    expect(historyCategory(event("1", { title: "Dinner", category_label: "Date night", category: "SOCIAL" }))).toBe("Date night");
    expect(historyCategory(event("2", { title: "Walk", category_label: null, category: "NATURE" }))).toBe("Nature");
    expect(historyCategory(event("3", { title: "Other", category_label: null, category: null }))).toBe("Other");
  });

  it("returns unique sorted categories and filters by category", () => {
    const events = [
      event("1", { title: "Dinner", category_label: "Food", category: "FOOD" }),
      event("2", { title: "Walk", category_label: null, category: "NATURE" }),
      event("3", { title: "Lunch", category_label: "Food", category: "FOOD" }),
    ];

    expect(historyCategories(events)).toEqual(["Food", "Nature"]);
    expect(filterHistoryEvents(events, "Nature").map((item) => item.id)).toEqual(["2"]);
    expect(filterHistoryEvents(events, "ALL")).toHaveLength(3);
  });
});
