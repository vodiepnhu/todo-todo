import { describe, expect, it, vi } from "vitest";
import {
  parseRagMetaFilters,
  reciprocalRankFusion,
} from "@/lib/rag/hybrid";
import {
  buildRagSearchQuery,
  hybridRetrieveItemHits,
  upsertItemEmbedding,
} from "@/services/rag-service";
import type { Item } from "@/types/database";

describe("reciprocalRankFusion", () => {
  it("boosts items appearing in multiple lists", () => {
    const a = [
      { id: "1", label: "a" },
      { id: "2", label: "b" },
    ];
    const b = [
      { id: "2", label: "b" },
      { id: "3", label: "c" },
    ];
    const fused = reciprocalRankFusion([a, b]);
    expect(fused[0]!.id).toBe("2");
  });
});

describe("parseRagMetaFilters", () => {
  it("keeps itemType null and detects beach tag", () => {
    expect(parseRagMetaFilters("beach places near me")).toEqual({
      itemType: null,
      tag: "beach",
    });
  });

  it("does not filter by legacy TODO keyword", () => {
    expect(parseRagMetaFilters("todo buy milk")).toMatchObject({
      itemType: null,
    });
  });
});

describe("buildRagSearchQuery", () => {
  it("keeps current request and newest chat context", () => {
    const chat = [
      "User: old unrelated request",
      "Planner: old response",
      "User: Draft: Bondi Beach",
      "Planner: Would you like to schedule it?",
    ].join("\n");

    const query = buildRagSearchQuery("change it to Saturday", chat, 70);

    expect(query).toContain("change it to Saturday");
    expect(query).toContain("Would you like to schedule it?");
    expect(query).not.toContain("old unrelated request");
  });
});

describe("English RAG normalization", () => {
  const item = {
    id: "item-1",
    workspace_id: "workspace-1",
    item_type: "ACTIVITY",
    subtype: "TASK",
    title: "Đi dạo cuối tuần",
    description: "Công viên yên tĩnh",
    category: null,
    category_label: null,
    priority: null,
    status: "ACTIVE",
    repeat_mode: "ONE_OFF",
    due_at: null,
    planned_start_at: null,
    time_precision: "UNKNOWN",
    estimated_duration_min: 30,
    duration_source: null,
    plan_status: "PLANNING",
    best_time: null,
    created_by: "user-1",
    last_updated_by: null,
    version: 1,
    source_text: null,
    created_at: "2026-10-08T00:00:00.000Z",
    updated_at: "2026-10-08T00:00:00.000Z",
    deleted_at: null,
  } as Item;

  it("stores original and English chunks during embedding upsert", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const supabase = { rpc } as never;

    await upsertItemEmbedding(
      supabase,
      item,
      undefined,
      undefined,
      { translate: async () => "Weekend walk · quiet park · 30min" },
    );

    expect(rpc).toHaveBeenCalledWith(
      "upsert_item_embedding",
      expect.objectContaining({
        p_chunk_text: expect.stringContaining("Đi dạo cuối tuần"),
        p_chunk_text_en: "Weekend walk · quiet park · 30min",
        p_source_language: "vi",
        p_translation_version: "v1",
      }),
    );
  });

  it("translates retrieval query before keyword and semantic search", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = { rpc } as never;
    const translate = vi.fn(async () => "weekend walk");

    await hybridRetrieveItemHits(supabase, ["workspace-1"], "đi dạo cuối tuần", {
      translate,
    });

    expect(translate).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith(
      "keyword_match_item_embeddings",
      expect.objectContaining({ p_query_text: "weekend walk" }),
    );
  });

  it("translates recent chat context before semantic retrieval", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = { rpc } as never;
    const translate = vi.fn(async (value: string) =>
      value.includes("bối cảnh") ? "recent context" : "weekend walk",
    );

    await hybridRetrieveItemHits(supabase, ["workspace-1"], "đi dạo", {
      recentChat: "bối cảnh cũ",
      translate,
    });

    expect(translate).toHaveBeenCalledTimes(2);
    expect(translate).toHaveBeenNthCalledWith(2, "bối cảnh cũ");
  });
});
