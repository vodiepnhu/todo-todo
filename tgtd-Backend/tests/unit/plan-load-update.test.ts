import { describe, expect, it } from "vitest";
import { seedPlanFromDescription } from "@/lib/plans/legacy-description";
import { emptyPlan } from "@/lib/plans/plan-schema";

describe("seedPlanFromDescription", () => {
  it("fills activities and food from legacy description when empty", () => {
    const draft = seedPlanFromDescription(
      emptyPlan(),
      "Activities:\nSwim\nWalk\n\nFood to try:\nFish tacos\n",
    );
    expect(draft.activities).toEqual(["Swim", "Walk"]);
    expect(draft.foodToTry).toEqual(["Fish tacos"]);
  });

  it("does not overwrite existing children", () => {
    const base = {
      ...emptyPlan(),
      activities: ["Keep"],
      foodToTry: ["Keep"],
    };
    const draft = seedPlanFromDescription(
      base,
      "Activities:\nOther\n\nFood to try:\nOther\n",
    );
    expect(draft.activities).toEqual(["Keep"]);
    expect(draft.foodToTry).toEqual(["Keep"]);
  });
});
