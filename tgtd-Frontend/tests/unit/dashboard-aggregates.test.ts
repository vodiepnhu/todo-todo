import { describe, expect, it } from "vitest";
import {
  categoryCounts,
  countOverdue,
  filterTodayItems,
  statusCounts,
  totalEstimatedCost,
  weekdayHeatmap,
  ymdInTz,
} from "@/lib/dashboard/aggregates";
import type { Item, ItemEvent, PlanCost } from "@/types/database";

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

describe("dashboard aggregates", () => {
  it("ymdInTz formats Sydney date", () => {
    expect(ymdInTz(new Date("2026-09-24T02:00:00Z"))).toMatch(/2026-09-2/);
  });

  it("status and category counts", () => {
    const items = [
      item({ id: "1", title: "a", status: "ACTIVE", category_label: "Food" }),
      item({ id: "2", title: "b", status: "COMPLETED", category_label: "Food" }),
      item({ id: "3", title: "c", status: "ACTIVE", category: "OTHER" }),
    ];
    expect(statusCounts(items).ACTIVE).toBe(2);
    expect(categoryCounts(items).find((c) => c.name === "Food")?.count).toBe(1);
  });

  it("overdue and today filters", () => {
    const now = new Date("2026-09-24T05:00:00Z"); // ~15:00 Sydney
    const items = [
      item({
        id: "1",
        title: "over",
        status: "ACTIVE",
        due_at: "2026-09-20T00:00:00+10:00",
      }),
      item({
        id: "2",
        title: "today",
        status: "ACTIVE",
        planned_start_at: "2026-09-24T10:00:00+10:00",
      }),
    ];
    expect(countOverdue(items, now)).toBe(1);
    expect(filterTodayItems(items, now).map((i) => i.id)).toEqual(["2"]);
  });

  it("cost total and weekday heatmap", () => {
    const costs: PlanCost[] = [
      {
        id: "c1",
        item_id: "i",
        category: "Food",
        estimated_amount: 10,
        actual_amount: null,
        currency: "AUD",
        note: null,
        sort_order: 0,
        created_at: "",
      },
      {
        id: "c2",
        item_id: "i",
        category: "Travel",
        estimated_amount: 5,
        actual_amount: 4,
        currency: "AUD",
        note: null,
        sort_order: 1,
        created_at: "",
      },
    ];
    expect(totalEstimatedCost(costs)).toBe(15);

    const events: ItemEvent[] = [
      {
        id: "e1",
        workspace_id: "w",
        item_id: "i",
        event_type: "COMPLETED",
        occurred_at: "2026-09-21T12:00:00+10:00", // Mon Sydney
        ended_at: null,
        time_precision: "DATE_ONLY",
        actual_duration_min: 30,
        place_id: null,
        note: null,
        recorded_by: "u",
        created_at: "",
      },
    ];
    const heat = weekdayHeatmap(events, "all");
    expect(heat.find((d) => d.day === "Mon")?.count).toBe(1);
  });
});
