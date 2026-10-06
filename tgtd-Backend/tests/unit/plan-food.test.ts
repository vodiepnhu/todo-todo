import { describe, expect, it } from "vitest";
import { buildPlanChildInserts } from "@/services/plan-persist-service";
import type { Plan } from "@/lib/plans/plan-schema";

function basePlan(partial: Partial<Plan> = {}): Plan {
  return {
    placeName: "Bondi",
    categories: [],
    tags: [],
    location: null,
    googleMapsUrl: null,
    status: "PLANNING",
    travel: null,
    experience: null,
    activities: [],
    foodToTry: ["Fish and chips"],
    preparations: [],
    todos: [],
    costs: [],
    notes: [],
    plannedStartAt: null,
    sourceText: null,
    ...partial,
  };
}

describe("buildPlanChildInserts food", () => {
  it("emits plan_food rows", () => {
    const rows = buildPlanChildInserts(basePlan(), "item-1");
    const food = rows.filter((r) => r.table === "plan_food");
    expect(food).toHaveLength(1);
    expect(food[0].row).toMatchObject({
      item_id: "item-1",
      label: "Fish and chips",
      done: false,
      sort_order: 0,
    });
  });
});
