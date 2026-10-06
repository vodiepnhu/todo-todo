import type { Item } from "../types/database";
import {
  rankPlaceCandidates,
  rankTaskCandidates,
  type RankedCandidate,
} from "@togo-todo/ai-rag";
import type { RagHit as RetrievalHit } from "@togo-todo/ai-rag";

export type RagHit = RetrievalHit;

/** Merge heuristic rank with vector hits (semantic boost). */
export function hybridRankCandidates(input: {
  intent: string;
  items: Item[];
  hits: RagHit[];
  availableMinutes?: number;
}): RankedCandidate[] {
  const hitScore = new Map(
    input.hits.map((h) => [h.sourceId, h.score] as const),
  );

  const base =
    input.intent === "RECOMMEND_PLACE"
      ? rankPlaceCandidates(input.items)
      : input.intent === "RECOMMEND_TASK"
        ? rankTaskCandidates(input.items, {
            availableMinutes: input.availableMinutes,
          })
        : [
            ...rankTaskCandidates(input.items, {
              availableMinutes: input.availableMinutes,
            }),
            ...rankPlaceCandidates(input.items),
          ];

  return base
    .map((c) => {
      const semantic = hitScore.get(c.item.id);
      if (semantic == null) return c;
      const boost = Math.round(semantic * 40);
      return {
        ...c,
        score: c.score + boost,
        // Keep human reasons only — semantic score is for ranking, not chat copy.
        reasons: c.reasons,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/** RAG agent — retrieve + hybrid rank for recommendations. */
export async function runRagAgent(input: {
  intent: string;
  workspaceIds: string[];
  query: string;
  listItems: (workspaceId: string) => Promise<Item[]>;
  retrieve?: (workspaceIds: string[], query: string) => Promise<RagHit[]>;
}): Promise<{
  candidates: RankedCandidate[];
  projectByItemId: Map<string, string>;
}> {
  const ids = input.workspaceIds.filter(Boolean);
  const [itemLists, hits] = await Promise.all([
    Promise.all(ids.map((id) => input.listItems(id))),
    input.retrieve
      ? input.retrieve(ids, input.query)
      : Promise.resolve([] as RagHit[]),
  ]);
  const items = itemLists.flat();
  const projectByItemId = new Map<string, string>();
  for (const h of hits) {
    if (h.projectName) projectByItemId.set(h.sourceId, h.projectName);
  }
  for (const item of items) {
    if (!projectByItemId.has(item.id)) {
      // fall back filled by caller if needed
    }
  }
  const candidates = hybridRankCandidates({
    intent: input.intent,
    items,
    hits,
  });
  return { candidates, projectByItemId };
}
