import { describe, expect, it } from "vitest";
import {
  filterListItems,
  isUpcomingItem,
  type ListFilter,
} from "@/lib/items/list-filters";
import type { Item } from "@/types/database";

function item(over: Partial<Item> & Pick<Item, "id" | "title" | "status">): Item {
  return {
    workspace_id: "w",
    item_type: "ACTIVITY",
    subtype: "TASK",
    description: null,
    category: null,
    category_label: null,
    priority: null,
    repeat_mode: "ONE_OFF",
    due_at: null,
    planned_start_at: null,
    time_precision: "UNKNOWN",
    estimated_duration_min: null,
    duration_source: null,
    plan_status: null,
    best_time: null,
    created_by: "u",
    last_updated_by: null,
    version: 1,
    source_text: null,
    created_at: "",
    updated_at: "",
    deleted_at: null,
    ...over,
  };
}

describe("list-filters", () => {
  const now = new Date("2026-09-24T05:00:00Z"); // ~15:00 Sydney

  it("isUpcomingItem requires ACTIVE and due/planned on or after Sydney today", () => {
    expect(
      isUpcomingItem(
        item({
          id: "1",
          title: "a",
          status: "ACTIVE",
          due_at: "2026-09-24T10:00:00+10:00",
        }),
        now,
      ),
    ).toBe(true);
    expect(
      isUpcomingItem(
        item({
          id: "2",
          title: "b",
          status: "ACTIVE",
          planned_start_at: "2026-09-25T10:00:00+10:00",
        }),
        now,
      ),
    ).toBe(true);
    expect(
      isUpcomingItem(
        item({
          id: "3",
          title: "past",
          status: "ACTIVE",
          due_at: "2026-09-20T10:00:00+10:00",
        }),
        now,
      ),
    ).toBe(false);
    expect(
      isUpcomingItem(
        item({ id: "4", title: "nodate", status: "ACTIVE" }),
        now,
      ),
    ).toBe(false);
    expect(
      isUpcomingItem(
        item({
          id: "5",
          title: "done",
          status: "COMPLETED",
          due_at: "2026-09-25T10:00:00+10:00",
        }),
        now,
      ),
    ).toBe(false);
  });

  it("filterListItems supports All / Upcoming / Visited / Skipped", () => {
    const items = [
      item({
        id: "a",
        title: "upcoming",
        status: "ACTIVE",
        due_at: "2026-09-25T10:00:00+10:00",
      }),
      item({ id: "b", title: "visited", status: "ACTIVE" }),
      item({ id: "c", title: "archived", status: "ARCHIVED" }),
      item({
        id: "s",
        title: "skipped",
        status: "ARCHIVED",
        plan_status: "SKIPPED",
      }),
    ];
    const visited = new Set(["b"]);

    expect(
      filterListItems(items, "All", visited, now).map((i) => i.id),
    ).toEqual(["a", "b", "s"]);
    expect(
      filterListItems(items, "Upcoming", visited, now).map((i) => i.id),
    ).toEqual(["a"]);
    expect(
      filterListItems(items, "Visited", visited, now).map((i) => i.id),
    ).toEqual(["b"]);
    expect(
      filterListItems(items, "Skipped", visited, now).map((i) => i.id),
    ).toEqual(["s"]);
  });

  it("ListFilter union covers four tabs", () => {
    const tabs: ListFilter[] = ["All", "Upcoming", "Visited", "Skipped"];
    expect(tabs).toHaveLength(4);
  });
});
