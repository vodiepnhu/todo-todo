import { describe, expect, it } from "vitest";
import { buildMutationDraft } from "@/agents/mutation-agent";
import {
  formatHelpReply,
  formatMutationReply,
  formatRecommendReply,
} from "@/agents/communication-agent";
import { hybridRankCandidates } from "@/agents/rag-agent";
import { extractAvailableMinutes } from "@/agents/rag-agent";
import type { Item } from "@/types/database";
import { emptyPlan } from "@/lib/plans/plan-schema";

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: "1",
    workspace_id: "w",
    item_type: "ACTIVITY",
    subtype: "TASK",
    title: "Buy groceries",
    description: null,
    category: null,
    category_label: null,
    priority: 1,
    status: "ACTIVE",
    repeat_mode: "ONE_OFF",
    due_at: new Date(Date.now() + 3600_000).toISOString(),
    planned_start_at: null,
    time_precision: "UNKNOWN",
    estimated_duration_min: 45,
    duration_source: null,
    plan_status: null,
    best_time: null,
    created_by: "u",
    last_updated_by: null,
    version: 1,
    source_text: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

describe("mutation-agent", () => {
  it("builds CREATE draft payload", () => {
    const draft = buildMutationDraft({
      intent: "CREATE_ITEM",
      message: "add milk https://maps.app.goo.gl/xyz",
      items: [{ title: "milk", itemType: "ACTIVITY", subtype: "TASK" }],
      extractMapsUrl: (t) =>
        t.includes("maps.app.goo.gl") ? "https://maps.app.goo.gl/xyz" : undefined,
    });
    expect(draft.actionType).toBe("CREATE");
    expect(draft.payload.title).toBe("milk");
    expect(draft.payload.googleMapsUrl).toBe("https://maps.app.goo.gl/xyz");
    expect(draft.draftTitle).toBe("milk");
  });
});

describe("communication-agent", () => {
  it("does not ask before creating a plan in recommendation replies", () => {
    const text = formatRecommendReply({
      intent: "RECOMMEND_PLACE",
      candidates: [{ item: item({ title: "Bondi Beach" }), score: 80, reasons: [] }],
    });

    expect(text).not.toContain("I will ask before creating a plan");
  });

  it("formats mutation draft with pending marker", () => {
    const text = formatMutationReply({
      baseReply: "Draft ready.",
      draftTitle: "milk",
      actionType: "CREATE",
      pendingId: "p1",
    });
    expect(text).toContain("[Confirm]");
    expect(text).toContain("pending:p1");
  });

  it("formats canonical plan fields with missing and confirm instruction", () => {
    const plan = {
      ...emptyPlan(),
      placeName: "Bondi Beach",
      categories: ["beach"],
      tags: ["family"],
      activities: ["Coastal walk", "Take photos"],
      preparations: ["Bring sunscreen"],
      googleMapsUrl: "https://maps.google.com/?cid=123",
      status: "PLANNING" as const,
    };

    const text = formatMutationReply({
      baseReply: "Draft ready.",
      draftTitle: "Bondi Beach",
      actionType: "CREATE",
      pendingId: "pending-plan-1",
      plan,
      extracted: [{ field: "date", value: "Saturday" }],
      suggestions: [
        { field: "activities", value: ["Coastal walk", "Take photos"] },
      ],
      missing: ["Exact date"],
    });

    expect(text).not.toContain("Extracted");
    expect(text).not.toContain("Suggestions");
    expect(text).toContain("🏷 Category: beach");
    expect(text).toContain("🎯 Activities:");
    expect(text).toContain("- Coastal walk");
    expect(text).toContain("Missing or uncertain");
    expect(text).toContain("Exact date");
    expect(text).toContain("Type CONFIRM to save this plan.");
    expect(text).toContain("pending:pending-plan-1");
  });

  it("renders canonical fields with form labels and icons", () => {
    const text = formatMutationReply({
      draftTitle: "Cafe", actionType: "CREATE", pendingId: "p1",
      plan: {
        ...emptyPlan(),
        placeName: "Cafe",
        categories: ["cafe"],
        plannedStartAt: "2026-10-08T09:00:00+11:00",
        experience: {
          estimatedDurationMin: 60,
          recommendedStartTime: "09:00",
          recommendedEndTime: "10:00",
          bestTime: "morning",
          flexibility: "flexible",
        },
        activities: ["Have coffee"],
        foodToTry: ["Pastry or breakfast item"],
      },
    });

    expect(text).toContain("🏷 Category: cafe");
    expect(text).toContain("📅 Date: 08 Oct 2026");
    expect(text).toContain("🕘 Time: 09:00");
    expect(text).toContain("✨ Experience:");
    expect(text).toContain("Duration: 60 min");
    expect(text).toContain("🎯 Activities:");
    expect(text).toContain("🍴 Food:");
    expect(text).not.toContain("experience.estimatedDurationMin");
    expect(text).not.toContain("plannedDate:");
  });

  it("shows generated suggestions without empty duplicate sections", () => {
    const text = formatMutationReply({
      draftTitle: "Icon Siam", actionType: "CREATE", pendingId: "p1",
      plan: {
        ...emptyPlan(),
        placeName: "Icon Siam",
        categories: ["Restaurant", "Lunch"],
        tags: ["food", "casual", "family"],
        travel: {
          from: null, to: null, transportMode: null,
          estimatedDurationMin: null, departureTime: null, arrivalTime: null, notes: null,
        },
        experience: {
          estimatedDurationMin: 90, recommendedStartTime: null,
          recommendedEndTime: null, bestTime: "afternoon", flexibility: null,
        },
      },
      extracted: [{ field: "details", value: "" }],
    });

    expect(text).toContain("🏷 Category: Restaurant, Lunch");
    expect(text).not.toContain("Suggestions:");
    expect(text).toContain("✨ Experience:");
    expect(text).toContain("Duration: 90 min");
    expect(text).not.toMatch(/🧳 Preparation:\n\n/);
    expect(text).not.toMatch(/✨ Experience:\n\n/);
    expect(text).not.toContain("Extracted:");
    expect(text).not.toContain("ℹ️ Details:");
  });

  it("shows canonical date, travel, experience, costs, and notes before confirmation", () => {
    const text = formatMutationReply({
      draftTitle: "Bondi Beach", actionType: "CREATE", pendingId: "p1",
      plan: {
        ...emptyPlan(), placeName: "Bondi Beach", plannedStartAt: "2026-10-10T14:00:00+11:00",
        travel: { from: "Gordon", to: "Bondi Beach", transportMode: "car", estimatedDurationMin: 45, departureTime: "13:00", arrivalTime: null, notes: "Avoid tolls" },
        experience: { estimatedDurationMin: 120, recommendedStartTime: "14:00", recommendedEndTime: "16:00", bestTime: "afternoon", flexibility: "fixed" },
        foodToTry: ["Gelato"], todos: [{ task: "Book parking", status: "pending", priority: "high", note: null }],
        costs: [{ category: "parking", estimatedAmount: 20, actualAmount: null, currency: "AUD", note: null }],
        notes: [{ type: "tip", content: "Arrive early" }],
      },
    });

    for (const detail of ["10 Oct 2026", "Gordon", "Car", "45", "13:00", "Avoid tolls", "120", "14:00", "16:00", "Afternoon", "Fixed", "Gelato", "Book parking", "Parking", "20", "AUD", "Arrive early"]) {
      expect(text).toContain(detail);
    }
    expect(text).not.toContain("plannedStartAt:");
    expect(text).toContain("pending:p1");
  });

  it("removes untrusted Maps metadata from extracted and suggested summaries", () => {
    const text = formatMutationReply({
      draftTitle: "Bondi Beach", actionType: "CREATE", pendingId: "p1",
      plan: {
        ...emptyPlan(),
        placeName: "Bondi Beach",
        plannedStartAt: "2026-10-10T14:00:00+11:00",
        notes: [{ type: "tip", content: "keep" }],
      },
      extracted: [
        { field: "googleMapsUrl", value: "https://evil.example/maps" },
        { field: "googlePlaceId", value: "fake-place-id" },
        { field: "latitude", value: -33.8 },
        { field: "address", value: "Fake address" },
        { field: "trip.placeName", value: "Fake place name" },
        { field: "place", value: { name: "Bondi Beach", longitude: 151.2, location: "Fake location" } },
        { field: "details", value: { keep: "safe", url: "https://evil.example", maps: "fake maps", place: { name: "Fake place" }, coordinates: { lat: -33.8 } } },
        { field: "plannedStartAt", value: "2026-10-10T14:00:00+11:00" },
      ],
      suggestions: [
        { field: "coordinates", value: { latitude: -33.8, longitude: 151.2 } },
        { field: "url", value: "https://evil.example" },
      ],
    });

    expect(text).toContain("Date: 10 Oct 2026");
    expect(text).toContain("Time: 14:00");
    expect(text).toContain("keep");
    for (const fake of ["evil.example", "fake-place-id", "-33.8", "Fake address", "151.2", "Fake location"]) {
      expect(text).not.toContain(fake);
    }
  });

  it("formats recommend options without internal semantic scores", () => {
    const text = formatRecommendReply({
      intent: "RECOMMEND_TASK",
      candidates: [
        {
          item: item(),
          score: 90,
          reasons: ["Due soon", "semantic 42%"],
        },
      ],
    });
    expect(text).toContain("Here are some options");
    expect(text).toContain("Buy groceries");
    expect(text).toContain("Due soon");
    expect(text).not.toMatch(/semantic/i);
    expect(text).not.toMatch(/\d+%/);
    expect(text).toMatch(/choose|pick/i);
  });

  it("asks for more detail when no saved recommendation matches", () => {
    const text = formatRecommendReply({
      intent: "RECOMMEND_TASK",
      candidates: [],
    });

    expect(text).toContain("matching saved activity");
    expect(text).toContain("Tell me more");
  });

  it("formats help from ingest reply", () => {
    expect(formatHelpReply("Say @Planner")).toBe("Say @Planner");
  });
});

describe("rag-agent hybridRank", () => {
  it("boosts items that appear in vector hits", () => {
    const groceries = item({ id: "a", title: "Buy groceries" });
    const unrelated = item({
      id: "b",
      title: "Call dentist",
      priority: 5,
      due_at: null,
      estimated_duration_min: 10,
    });
    const ranked = hybridRankCandidates({
      intent: "RECOMMEND_TASK",
      items: [unrelated, groceries],
      hits: [{ sourceId: "a", score: 0.92, chunkText: "Buy groceries" }],
    });
    expect(ranked[0].item.id).toBe("a");
    expect(ranked[0].reasons.some((r) => /semantic/i.test(r))).toBe(false);
  });

  it("excludes unrelated walks from food recommendations", () => {
    const walk = item({ id: "walk", title: "Coastal walk" });
    const food = item({
      id: "food",
      title: "Dinner at a restaurant",
      category: "FOOD",
      category_label: "Food",
    });

    const ranked = hybridRankCandidates({
      intent: "RECOMMEND_TASK",
      items: [walk, food],
      hits: [],
      query: "I want to go somewhere for food, any recommendations?",
    });

    expect(ranked.map((candidate) => candidate.item.id)).toEqual(["food"]);
  });

  it("falls back to heuristic when no hits", () => {
    const overdue = item({
      id: "o",
      title: "Overdue bill",
      due_at: new Date(Date.now() - 86400_000).toISOString(),
    });
    const ranked = hybridRankCandidates({
      intent: "RECOMMEND_TASK",
      items: [overdue],
      hits: [],
    });
    expect(ranked[0].item.id).toBe("o");
  });
});
