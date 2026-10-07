import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractPlanFromChat } from "@/lib/ai/extract-plan";
import { emptyPlan, type PlanDraft } from "@/lib/plans/plan-schema";

const mocks = vi.hoisted(() => ({
  resolveLlmCallConfig: vi.fn(),
  chatCompletionJson: vi.fn(),
}));

vi.mock("@/services/llm-settings-service", () => ({
  resolveLlmCallConfig: mocks.resolveLlmCallConfig,
}));

vi.mock("@/lib/ai/providers", () => ({
  chatCompletionJson: mocks.chatCompletionJson,
}));

const uid = "00000000-0000-0000-0000-000000000001";

function plan(overrides: Partial<PlanDraft> = {}): PlanDraft {
  return {
    ...emptyPlan(),
    placeName: "Bondi Beach",
    status: "PLANNING",
    categories: ["beach"],
    tags: ["family"],
    activities: ["Swimming"],
    preparations: ["Pack towels"],
    experience: {
      estimatedDurationMin: 120,
      recommendedStartTime: null,
      recommendedEndTime: null,
      bestTime: "morning",
      flexibility: "flexible",
    },
    ...overrides,
  };
}

beforeEach(() => {
  mocks.resolveLlmCallConfig.mockResolvedValue(null);
  mocks.chatCompletionJson.mockReset();
});

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

  it("reports Maps configuration failure separately from mock LLM mode", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", "");
    const result = await extractPlanFromChat({
      userId: uid,
      text: "Bondi Beach",
      lookupMaps: true,
    });
    expect(result.mapsDegraded).toBe(true);
    expect(result.mapsNote).toMatch(/free Google Maps search/i);
  });

  it("sends base plan with latest request and returns complete merged draft", async () => {
    const basePlan = plan({
      plannedStartAt: "2026-10-10T09:00:00.000+11:00",
    });
    const merged = plan({
      plannedStartAt: "2026-10-10T15:00:00.000+11:00",
      preparations: ["Pack towels", "Bring sunscreen"],
    });
    mocks.resolveLlmCallConfig.mockResolvedValue({
      provider: "custom",
      model: "local-test",
      apiKey: null,
      baseUrl: "http://localhost:1234/v1",
    });
    mocks.chatCompletionJson.mockResolvedValue({
      content: JSON.stringify(merged),
      model: "local-test",
    });

    const { draft } = await extractPlanFromChat({
      userId: uid,
      text: "Make it Saturday afternoon and add bring sunscreen.",
      timezone: "Australia/Sydney",
      lookupMaps: false,
      basePlan,
    });

    const payload = JSON.parse(
      mocks.chatCompletionJson.mock.calls[0][1][1].content,
    );
    expect(payload.text).toBe(
      "Make it Saturday afternoon and add bring sunscreen.",
    );
    expect(payload.basePlan).toEqual(basePlan);
    expect(draft).toMatchObject({
      placeName: "Bondi Beach",
      plannedStartAt: "2026-10-10T15:00:00.000+11:00",
      preparations: ["Pack towels", "Bring sunscreen"],
    });
  });

  it("normalizes nested model envelope to canonical plan and metadata", async () => {
    const canonicalPlan = plan({
      placeName: "Wendy Whiteley's Secret Garden",
      categories: [],
      tags: ["explicit"],
      activities: [],
      preparations: [],
      experience: null,
    });
    mocks.resolveLlmCallConfig.mockResolvedValue({
      provider: "custom",
      model: "local-test",
      apiKey: null,
      baseUrl: "http://localhost:1234/v1",
    });
    mocks.chatCompletionJson.mockResolvedValue({
      content: JSON.stringify({
        plan: canonicalPlan,
        extracted: [
          { field: "placeName", value: "Wendy Whiteley's Secret Garden" },
        ],
        suggestions: [
          { field: "categories", value: ["garden"] },
          { field: "tags", value: ["quiet"] },
          { field: "activities", value: ["Walk the paths", "Take photos"] },
          { field: "preparations", value: ["Bring water"] },
          { field: "experience.estimatedDurationMin", value: 90 },
          { field: "experience.bestTime", value: "afternoon" },
        ],
      }),
      model: "local-test",
    });

    const result = await extractPlanFromChat({
      userId: uid,
      text: "Visit Wendy Whiteley's Secret Garden.",
      lookupMaps: false,
    });

    expect(result.mocked).toBe(false);
    expect(result.draft.placeName).toBe("Wendy Whiteley's Secret Garden");
    expect(result.draft.categories).toEqual(["garden"]);
    expect(result.draft.tags).toEqual(["explicit"]);
    expect(result.draft.activities).toEqual(["Walk the paths", "Take photos"]);
    expect(result.draft.preparations).toEqual(["Bring water"]);
    expect(result.draft.experience).toMatchObject({
      estimatedDurationMin: 90,
      bestTime: "afternoon",
    });
    expect(result.extracted).toEqual([
      { field: "placeName", value: "Wendy Whiteley's Secret Garden" },
    ]);
    expect(result.suggestions).toEqual([
      { field: "categories", value: ["garden"] },
      { field: "tags", value: ["quiet"] },
      { field: "activities", value: ["Walk the paths", "Take photos"] },
      { field: "preparations", value: ["Bring water"] },
      { field: "experience.estimatedDurationMin", value: 90 },
      { field: "experience.bestTime", value: "afternoon" },
    ]);
  });

  it("rejects untrusted model maps URLs", async () => {
    mocks.resolveLlmCallConfig.mockResolvedValue({
      provider: "custom",
      model: "local-test",
      apiKey: null,
      baseUrl: "http://localhost:1234/v1",
    });
    mocks.chatCompletionJson.mockResolvedValue({
      content: JSON.stringify({ ...plan(), googleMapsUrl: "https://evil.test" }),
      model: "local-test",
    });

    const result = await extractPlanFromChat({
      userId: uid,
      text: "Bondi Beach",
      lookupMaps: false,
    });

    expect(result.draft.googleMapsUrl).toBeNull();
  });

  it("preserves omitted merge fields while explicit empty arrays and null replace them", async () => {
    const basePlan = plan({
      foodToTry: ["Gelato"],
      notes: [{ type: "tip", content: "Book ahead" }],
      travel: {
        from: "Gordon", to: "Bondi Beach", transportMode: "car",
        estimatedDurationMin: 45, departureTime: "09:00", arrivalTime: null,
        notes: "Avoid tolls",
      },
    });
    mocks.resolveLlmCallConfig.mockResolvedValue({ provider: "custom", model: "local-test", apiKey: null, baseUrl: "http://localhost:1234/v1" });
    mocks.chatCompletionJson.mockResolvedValue({
      content: JSON.stringify({
        plan: { activities: [], experience: { bestTime: "afternoon" }, travel: { notes: null } },
      }),
      model: "local-test",
    });

    const result = await extractPlanFromChat({
      userId: uid, text: "Remove all activities; afternoon; clear travel notes", basePlan,
      lookupMaps: false,
    });

    expect(result.fallbackReason).toBeUndefined();
    expect(result.draft.activities).toEqual([]);
    expect(result.draft.foodToTry).toEqual(["Gelato"]);
    expect(result.draft.notes).toEqual([{ type: "tip", content: "Book ahead" }]);
    expect(result.draft.travel).toMatchObject({ from: "Gordon", transportMode: "car", estimatedDurationMin: 45, notes: null });
    expect(result.draft.experience).toMatchObject({ estimatedDurationMin: 120, bestTime: "afternoon", flexibility: "flexible" });
  });

  it("uses Maps URL from current request instead of recent history or model", async () => {
    const currentUrl = "https://www.google.com/maps/search/?api=1&query=Manly";
    const oldUrl = "https://www.google.com/maps/search/?api=1&query=Bondi";
    mocks.resolveLlmCallConfig.mockResolvedValue({ provider: "custom", model: "local-test", apiKey: null, baseUrl: "http://localhost:1234/v1" });
    mocks.chatCompletionJson.mockResolvedValue({
      content: JSON.stringify({ ...plan({ placeName: "Manly Beach" }), googleMapsUrl: oldUrl }),
      model: "local-test",
    });

    const result = await extractPlanFromChat({
      userId: uid, text: `Recent context: ${oldUrl}\nCurrent request: move to Manly ${currentUrl}`,
      currentRequest: `move to Manly ${currentUrl}`, lookupMaps: false,
    });

    expect(result.draft.googleMapsUrl).toBe(currentUrl);
    expect(result.mapsMetadataTrusted).toBe(true);
    expect(JSON.parse(mocks.chatCompletionJson.mock.calls[0][1][1].content).mapsUrl).toBe(currentUrl);
  });

  it("does not promote a history Maps URL when current request has none", async () => {
    const oldUrl = "https://www.google.com/maps/search/?api=1&query=Bondi";
    mocks.resolveLlmCallConfig.mockResolvedValue({ provider: "custom", model: "local-test", apiKey: null, baseUrl: "http://localhost:1234/v1" });
    mocks.chatCompletionJson.mockResolvedValue({ content: JSON.stringify({ placeName: "Manly Beach", googleMapsUrl: oldUrl }), model: "local-test" });

    const result = await extractPlanFromChat({
      userId: uid, text: `Recent context: ${oldUrl}\nCurrent request: move to Manly`,
      currentRequest: "move to Manly", lookupMaps: false,
    });

    expect(result.draft.googleMapsUrl).toBeNull();
    expect(JSON.parse(mocks.chatCompletionJson.mock.calls[0][1][1].content).mapsUrl).toBeNull();
  });

  it("rejects model-supplied place metadata even when Maps URL has trusted host", async () => {
    mocks.resolveLlmCallConfig.mockResolvedValue({ provider: "custom", model: "local-test", apiKey: null, baseUrl: "http://localhost:1234/v1" });
    mocks.chatCompletionJson.mockResolvedValue({
      content: JSON.stringify({ ...plan(), googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Fake", googlePlaceId: "fake-id", latitude: 1, longitude: 2, location: "Fake address" }),
      model: "local-test",
    });

    const result = await extractPlanFromChat({ userId: uid, text: "Bondi Beach", lookupMaps: false });

    expect(result.draft).toMatchObject({ googleMapsUrl: null, googlePlaceId: null, latitude: null, longitude: null, location: null });
    expect(result.mapsMetadataTrusted).toBe(false);
  });

  it("asks initial model for extracted, suggestions, and missing metadata", async () => {
    mocks.resolveLlmCallConfig.mockResolvedValue({ provider: "custom", model: "local-test", apiKey: null, baseUrl: "http://localhost:1234/v1" });
    mocks.chatCompletionJson.mockResolvedValue({ content: JSON.stringify({ placeName: "Bondi Beach" }), model: "local-test" });

    await extractPlanFromChat({ userId: uid, text: "Visit Bondi Beach", lookupMaps: false });

    const prompt = mocks.chatCompletionJson.mock.calls[0][1][0].content;
    expect(prompt).toContain("extracted");
    expect(prompt).toContain("suggestions");
    expect(prompt).toContain("missing");
  });

  it("uses computed missing fields instead of model-reported uncertainty", async () => {
    mocks.resolveLlmCallConfig.mockResolvedValue({ provider: "custom", model: "local-test", apiKey: null, baseUrl: "http://localhost:1234/v1" });
    mocks.chatCompletionJson.mockResolvedValue({
      content: JSON.stringify({ plan: { placeName: "Bondi Beach" }, missing: ["Booking details"] }),
      model: "local-test",
    });

    const result = await extractPlanFromChat({ userId: uid, text: "Visit Bondi Beach", lookupMaps: false });

    expect(result.missing).not.toContain("Booking details");
    expect(result.missing).toContain("Google Maps link");
  });
});
