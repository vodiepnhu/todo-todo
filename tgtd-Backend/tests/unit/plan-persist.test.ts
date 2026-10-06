import { describe, expect, it } from "vitest";
import { PlanSchema } from "@/lib/plans/plan-schema";
import { buildPlanChildInserts } from "@/services/plan-persist-service";

describe("buildPlanChildInserts", () => {
  it("maps travel/costs/activities/preparations/notes", () => {
    const plan = PlanSchema.parse({
      placeName: "Bondi Beach",
      status: "PLANNING",
      location: "NSW",
      googleMapsUrl: null,
      categories: ["beach"],
      travel: {
        from: "Gordon",
        to: "Bondi",
        transportMode: "car",
        estimatedDurationMin: 45,
        departureTime: null,
        arrivalTime: null,
        notes: null,
      },
      experience: { estimatedDurationMin: 120, bestTime: "sunset" },
      activities: ["Walk"],
      preparations: ["Sunscreen"],
      costs: [
        {
          category: "parking",
          estimatedAmount: 20,
          actualAmount: null,
          currency: "AUD",
          note: null,
        },
      ],
      notes: [{ type: "general", content: "Crowded" }],
    });
    const rows = buildPlanChildInserts(plan, "item-1");
    expect(rows.find((r) => r.table === "plan_travel")?.row).toMatchObject({
      from_text: "Gordon",
      transport_mode: "car",
    });
    expect(rows.filter((r) => r.table === "plan_costs")).toHaveLength(1);
    expect(rows.filter((r) => r.table === "plan_activities")).toHaveLength(1);
    expect(rows.filter((r) => r.table === "plan_preparations")).toHaveLength(1);
    expect(rows.filter((r) => r.table === "plan_notes")).toHaveLength(1);
  });
});
