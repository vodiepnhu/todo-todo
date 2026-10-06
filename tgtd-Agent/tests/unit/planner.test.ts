import { describe, expect, it } from "vitest";
import { PlannerRequestSchema } from "@/schemas/planner";
import {
  rankTaskCandidates,
  rankPlaceCandidates,
} from "@togo-todo/ai-rag";
import {
  extractGoogleMapsUrl,
  safeMapsRedirect,
} from "@/lib/maps/maps";
import type { Item } from "@/types/database";

describe("PlannerRequestSchema", () => {
  it("parses CREATE_ITEM", () => {
    const parsed = PlannerRequestSchema.parse({
      intent: "CREATE_ITEM",
      confidence: 0.9,
      items: [{ title: "IKEA Tempe", itemType: "ACTIVITY", subtype: "TASK" }],
      ambiguities: [],
    });
    expect(parsed.intent).toBe("CREATE_ITEM");
    expect(parsed.items[0].title).toBe("IKEA Tempe");
  });
});

describe("recommendations", () => {
  const base: Item = {
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
  };

  it("ranks tasks by feasibility", () => {
    const ranked = rankTaskCandidates([base], { availableMinutes: 60 });
    expect(ranked[0].item.title).toBe("Buy groceries");
    expect(ranked[0].score).toBeGreaterThan(50);
  });

  it("ranks places", () => {
    const place = {
      ...base,
      id: "2",
      item_type: "ACTIVITY" as const,
      subtype: "TASK" as const,
      title: "Manly",
      plan_status: "PLANNING" as const,
    };
    expect(rankPlaceCandidates([place])).toHaveLength(1);
  });
});

describe("maps helpers", () => {
  it("extracts trusted maps urls", () => {
    const url = extractGoogleMapsUrl(
      "Meet here https://maps.app.goo.gl/abc123 tonight",
    );
    expect(url).toContain("maps.app.goo.gl");
  });

  it("rejects untrusted redirects", () => {
    expect(safeMapsRedirect("https://evil.example/phish")).toBeNull();
    expect(
      safeMapsRedirect("https://www.google.com/maps/place/Sydney"),
    ).toContain("google.com");
  });
});
