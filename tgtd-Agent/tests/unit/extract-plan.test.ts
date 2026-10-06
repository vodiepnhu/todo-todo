import { describe, expect, it } from "vitest";
import { extractPlanFromChat } from "@/lib/ai/extract-plan";

const uid = "00000000-0000-0000-0000-000000000001";

describe("extractPlanFromChat soft estimate", () => {
  it("keeps Bondi detailed extract (travel/costs when stated)", async () => {
    const { draft, missing, mocked } = await extractPlanFromChat({
      userId: uid,
      text: "Maybe we can go to Bondi Beach this Saturday. It takes around 45 mins from Gordon by car. Spend about 2 hours around sunset. Parking might cost $20 and $50 for dinner. Bring sunscreen and check the weather. Coastal walk and take photos.",
      lookupMaps: false,
    });
    expect(mocked).toBe(true);
    expect(draft.placeName.toLowerCase()).toContain("bondi");
    expect(draft.travel?.from?.toLowerCase()).toBe("gordon");
    expect(draft.travel?.estimatedDurationMin).toBe(45);
    expect(draft.experience?.estimatedDurationMin).toBe(120);
    expect(draft.experience?.bestTime).toBe("sunset");
    expect(draft.activities.length).toBeGreaterThan(0);
    expect(draft.preparations.length).toBeGreaterThan(0);
    expect(draft.costs.some((c) => c.category === "parking")).toBe(true);
    expect(draft.googleMapsUrl).toBeNull();
    expect(missing).toContain("Google Maps link");
  });

  it("soft-suggests fields for short place-only text without inventing maps/costs", async () => {
    const { draft, mocked } = await extractPlanFromChat({
      userId: uid,
      text: "Bondi Beach Saturday",
      lookupMaps: false,
    });
    expect(mocked).toBe(true);
    expect(draft.placeName.toLowerCase()).toContain("bondi");
    expect(draft.categories.length).toBeGreaterThan(0);
    expect(draft.tags.length).toBeGreaterThan(0);
    expect(draft.activities.length).toBeGreaterThanOrEqual(2);
    expect(draft.preparations.length).toBeGreaterThan(0);
    expect(draft.experience?.estimatedDurationMin).toBeTruthy();
    expect(draft.experience?.bestTime).toBeTruthy();
    expect(draft.status).toBe("PLANNING");
    expect(draft.googleMapsUrl).toBeNull();
    expect(draft.costs).toEqual([]);
    expect(draft.travel).toBeNull();
  });

  it("does not invent costs when amounts absent", async () => {
    const { draft } = await extractPlanFromChat({
      userId: uid,
      text: "Cafe in Surry Hills for brunch",
      lookupMaps: false,
    });
    expect(draft.costs).toEqual([]);
    expect(draft.categories.length).toBeGreaterThan(0);
  });
});
