import { describe, expect, it } from "vitest";
import { buildMutationDraft } from "@/agents/mutation-agent";
import {
  formatHelpReply,
  formatMutationReply,
  formatRecommendReply,
} from "@/agents/communication-agent";
import { hybridRankCandidates } from "@/agents/rag-agent";
import type { Item } from "@/types/database";

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
