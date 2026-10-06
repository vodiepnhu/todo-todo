import { describe, expect, it } from "vitest";
import { PlanSchema, emptyPlan } from "@/lib/plans/plan-schema";
import {
  applyNotesText,
  notesTextFromPlan,
  planToPendingPayload,
} from "@/lib/plans/plan-payload";

describe("plan-payload", () => {
  it("round-trips notes textarea", () => {
    const base = emptyPlan();
    const withNotes = applyNotesText(base, "Crowded on weekends.\nParking hard.");
    expect(notesTextFromPlan(withNotes)).toContain("Crowded on weekends");
    expect(withNotes.notes).toEqual([
      { type: "general", content: "Crowded on weekends.\nParking hard." },
    ]);
    expect(applyNotesText(withNotes, "  ").notes).toEqual([]);
  });

  it("builds pending payload tagged schema=plan", () => {
    const plan = PlanSchema.parse({
      placeName: "Bondi Beach",
      status: "PLANNING",
      categories: ["beach"],
      travel: {
        from: "Gordon",
        to: "Bondi Beach",
        transportMode: "car",
        estimatedDurationMin: 45,
        departureTime: null,
        arrivalTime: null,
        notes: null,
      },
      experience: { estimatedDurationMin: 120, bestTime: "sunset" },
      activities: ["Coastal walk"],
      preparations: ["Bring sunscreen"],
      costs: [
        {
          category: "parking",
          estimatedAmount: 20,
          actualAmount: null,
          currency: "AUD",
          note: null,
        },
      ],
    });
    const payload = planToPendingPayload(plan, "chat blob");
    expect(payload.schema).toBe("plan");
    expect(payload.itemType).toBe("ACTIVITY");
    expect(payload.subtype).toBe("TASK");
    expect(payload.title).toBe("Bondi Beach");
    expect(payload.plan).toMatchObject({
      placeName: "Bondi Beach",
      status: "PLANNING",
    });
    expect(payload.sourceText).toBe("chat blob");
  });
});
