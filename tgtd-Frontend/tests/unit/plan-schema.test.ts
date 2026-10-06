import { describe, expect, it } from "vitest";
import {
  PlanDraftSchema,
  PlanSchema,
  emptyPlan,
  estimatedCostTotal,
  planStatusToItemStatus,
} from "@/lib/plans/plan-schema";

describe("PlanSchema", () => {
  it("accepts minimal place name with empty collections", () => {
    const parsed = PlanSchema.parse({
      placeName: "Bondi Beach",
      status: "PLANNING",
    });
    expect(parsed.placeName).toBe("Bondi Beach");
    expect(parsed.categories).toEqual([]);
    expect(parsed.travel).toBeNull();
    expect(parsed.costs).toEqual([]);
    expect(parsed.activities).toEqual([]);
    expect(parsed.preparations).toEqual([]);
    expect(parsed.notes).toEqual([]);
  });

  it("rejects empty placeName", () => {
    expect(() =>
      PlanSchema.parse({ placeName: "  ", status: "PLANNING" }),
    ).toThrow();
  });

  it("parses Bondi-shaped extract without inventing maps", () => {
    const parsed = PlanSchema.parse({
      placeName: "Bondi Beach",
      categories: ["beach", "outdoor"],
      location: "Bondi Beach, NSW",
      googleMapsUrl: null,
      status: "PLANNING",
      travel: {
        from: "Gordon",
        to: "Bondi Beach",
        transportMode: "car",
        estimatedDurationMin: 45,
        departureTime: null,
        arrivalTime: null,
        notes: null,
      },
      experience: {
        estimatedDurationMin: 120,
        bestTime: "sunset",
      },
      activities: ["Coastal walk", "Take photos"],
      preparations: ["Bring sunscreen", "Check weather"],
      costs: [
        {
          category: "parking",
          estimatedAmount: 20,
          actualAmount: null,
          currency: "AUD",
          note: null,
        },
        {
          category: "food",
          estimatedAmount: 50,
          actualAmount: null,
          currency: "AUD",
          note: "Dinner",
        },
      ],
      notes: [],
      plannedStartAt: null,
    });
    expect(parsed.googleMapsUrl).toBeNull();
    expect(estimatedCostTotal(parsed)).toBe(70);
  });

  it("maps plan status to item_status", () => {
    expect(planStatusToItemStatus("PLANNING")).toBe("ACTIVE");
    expect(planStatusToItemStatus("VISITED")).toBe("COMPLETED");
    expect(planStatusToItemStatus("SKIPPED")).toBe("ARCHIVED");
  });

  it("emptyPlan is draft-valid but not persist-valid", () => {
    const e = emptyPlan();
    expect(PlanDraftSchema.safeParse(e).success).toBe(true);
    expect(PlanSchema.safeParse(e).success).toBe(false);
  });
});
