import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "../types/database";
import type { RagHit } from "../types";
import {
  embedText,
  vectorToPgLiteral,
} from "./embedding-service";
import {
  parseRagMetaFilters,
  reciprocalRankFusion,
} from "../lib/rag/hybrid";

export function buildItemChunkText(
  item: Pick<
    Item,
    "title" | "item_type" | "subtype" | "description" | "category_label"
  > & {
    plan_status?: string | null;
    best_time?: string | null;
    estimated_duration_min?: number | null;
  },
  extras?: {
    placeName?: string | null;
    location?: string | null;
    categories?: string[];
    tags?: string[];
    travel?: string | null;
    activities?: string[];
    preparations?: string[];
    costsSummary?: string | null;
    notes?: string[];
  },
): string {
  return [
    item.title,
    item.item_type,
    item.subtype,
    item.plan_status,
    item.best_time,
    item.estimated_duration_min != null
      ? `${item.estimated_duration_min}min`
      : null,
    item.category_label,
    item.description,
    extras?.placeName,
    extras?.location,
    extras?.categories?.join(" "),
    extras?.tags?.join(" "),
    extras?.travel,
    extras?.activities?.join("; "),
    extras?.preparations?.join("; "),
    extras?.costsSummary,
    extras?.notes?.join("; "),
  ]
    .filter(Boolean)
    .join(" · ");
}

export async function upsertItemEmbedding(
  supabase: SupabaseClient,
  item: Item,
  projectMeta?: {
    projectName?: string;
    tags?: string[];
  },
  chunkOverride?: string,
): Promise<void> {
  const chunk = chunkOverride || buildItemChunkText(item);
  const { embedding, model } = await embedText(chunk);
  const { error } = await supabase.rpc("upsert_item_embedding", {
    p_workspace_id: item.workspace_id,
    p_source_type: "item",
    p_source_id: item.id,
    p_chunk_text: chunk,
    p_embedding: vectorToPgLiteral(embedding),
    p_metadata: {
      item_type: item.item_type,
      subtype: item.subtype,
      plan_status: item.plan_status ?? null,
      model,
      project_name: projectMeta?.projectName,
      tags: projectMeta?.tags ?? [],
    },
  });
  if (error) {
    console.warn("upsertItemEmbedding failed", error.message);
  }
}

export async function deleteItemEmbedding(
  supabase: SupabaseClient,
  sourceId: string,
): Promise<void> {
  const { error } = await supabase
    .from("item_embeddings")
    .delete()
    .eq("source_type", "item")
    .eq("source_id", sourceId);
  if (error) {
    console.warn("deleteItemEmbedding failed", error.message);
  }
}

export type RetrievedHit = RagHit & {
  workspaceId: string;
  projectName: string;
  channel?: "semantic" | "keyword" | "chat" | "hybrid";
};

type RpcRow = {
  source_id: string;
  chunk_text: string;
  score: number;
  workspace_id: string;
  project_name: string;
};

async function semanticHits(
  supabase: SupabaseClient,
  ids: string[],
  query: string,
  limit: number,
  itemType: string | null,
  tag: string | null,
): Promise<RetrievedHit[]> {
  const { embedding } = await embedText(query);
  const { data, error } = await supabase.rpc("match_item_embeddings", {
    p_workspace_ids: ids,
    p_query: vectorToPgLiteral(embedding),
    p_match_count: limit,
    p_item_type: itemType,
    p_tag: tag,
  });
  if (error) {
    // Fallback to 3-arg if 5-arg migration not applied yet
    const fb = await supabase.rpc("match_item_embeddings", {
      p_workspace_ids: ids,
      p_query: vectorToPgLiteral(embedding),
      p_match_count: limit,
    });
    if (fb.error) {
      console.warn("match_item_embeddings failed", error.message);
      return [];
    }
    return mapRows(fb.data as RpcRow[], "semantic");
  }
  return mapRows((data ?? []) as RpcRow[], "semantic");
}

async function keywordHits(
  supabase: SupabaseClient,
  ids: string[],
  query: string,
  limit: number,
  itemType: string | null,
  tag: string | null,
): Promise<RetrievedHit[]> {
  const { data, error } = await supabase.rpc("keyword_match_item_embeddings", {
    p_workspace_ids: ids,
    p_query_text: query,
    p_match_count: limit,
    p_item_type: itemType,
    p_tag: tag,
  });
  if (error) {
    console.warn("keyword_match_item_embeddings failed", error.message);
    return [];
  }
  return mapRows((data ?? []) as RpcRow[], "keyword");
}

function mapRows(
  rows: RpcRow[],
  channel: RetrievedHit["channel"],
): RetrievedHit[] {
  return rows.map((r) => ({
    sourceId: r.source_id,
    chunkText: r.chunk_text,
    score: Number(r.score) || 0,
    workspaceId: r.workspace_id,
    projectName: r.project_name,
    channel,
  }));
}

/** Keyword scan of recent non-deleted chat (not embedded). */
export async function keywordMatchChatMessages(
  supabase: SupabaseClient,
  workspaceId: string,
  query: string,
  limit = 8,
): Promise<RetrievedHit[]> {
  const tokens = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length >= 3)
    .slice(0, 6);
  if (!tokens.length) return [];

  const { data, error } = await supabase
    .from("workspace_messages")
    .select("id, content, workspace_id, created_at")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error || !data) return [];

  const scored = data
    .map((m) => {
      const text = String(m.content ?? "").toLowerCase();
      const hits = tokens.filter((t) => text.includes(t)).length;
      return { m, hits };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit);

  return scored.map((x, i) => ({
    sourceId: x.m.id,
    chunkText: String(x.m.content ?? "").slice(0, 400),
    score: x.hits / tokens.length,
    workspaceId: x.m.workspace_id,
    projectName: "chat",
    channel: "chat" as const,
  }));
}

export function buildRagSearchQuery(
  query: string,
  recentChat?: string,
  maxContextChars = 1200,
): string {
  const current = query.trim();
  const context = recentChat?.trim().slice(-maxContextChars);
  return context ? `${current}\nRecent context:\n${context}` : current;
}

/**
 * Hybrid retrieve: semantic (pgvector) + keyword (FTS) + optional chat keyword,
 * fused with Reciprocal Rank Fusion. Metadata filters from query heuristics.
 */
export async function hybridRetrieveItemHits(
  supabase: SupabaseClient,
  workspaceIds: string | string[],
  query: string,
  opts?: {
    limit?: number;
    includeChat?: boolean;
    recentChat?: string;
  },
): Promise<RetrievedHit[]> {
  const ids = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];
  if (!ids.length || !query.trim()) return [];
  const limit = opts?.limit ?? 20;
  const filters = parseRagMetaFilters(query);
  const expanded = buildRagSearchQuery(query, opts?.recentChat);

  const [sem, kw, chat] = await Promise.all([
    semanticHits(
      supabase,
      ids,
      expanded,
      limit,
      filters.itemType ?? null,
      filters.tag ?? null,
    ),
    keywordHits(
      supabase,
      ids,
      query,
      limit,
      filters.itemType ?? null,
      filters.tag ?? null,
    ),
    opts?.includeChat && ids.length === 1
      ? keywordMatchChatMessages(supabase, ids[0]!, query, 8)
      : Promise.resolve([] as RetrievedHit[]),
  ]);

  const fused = reciprocalRankFusion(
    [
      sem.map((h) => ({ id: h.sourceId, hit: h })),
      kw.map((h) => ({ id: h.sourceId, hit: h })),
      chat.map((h) => ({ id: `chat:${h.sourceId}`, hit: h })),
    ],
    { k: 60, weights: [1, 1, 0.7] },
  );

  return fused.slice(0, limit).map((f) => ({
    ...f.item.hit,
    score: f.score,
    channel: "hybrid",
  }));
}

/** @deprecated prefer hybridRetrieveItemHits — kept for callers/tests */
export async function retrieveItemHits(
  supabase: SupabaseClient,
  workspaceIds: string | string[],
  query: string,
  limit = 20,
): Promise<RetrievedHit[]> {
  return hybridRetrieveItemHits(supabase, workspaceIds, query, { limit });
}
