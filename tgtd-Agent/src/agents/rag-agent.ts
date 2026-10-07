import type { Item } from "../types/database";
import {
  rankPlaceCandidates,
  rankTaskCandidates,
  type RankedCandidate,
} from "@togo-todo/ai-rag";
import type { RagHit as RetrievalHit } from "@togo-todo/ai-rag";

export type RagHit = RetrievalHit;

const FOOD_QUERY_RE = /\b(?:food|eat|eating|dinner|lunch|breakfast|brunch|restaurant|cafe|coffee|meal|drink|ăn|uống|nhà hàng|quán|cà phê|bữa)\b/i;
const FOOD_ITEM_RE = /\b(?:food|eat|eating|dinner|lunch|breakfast|brunch|restaurant|cafe|coffee|meal|drink|ăn|uống|nhà hàng|quán|cà phê|bữa)\b/i;

function isFoodItem(item: Item): boolean {
  if (item.category === "FOOD") return true;
  return FOOD_ITEM_RE.test(
    [item.title, item.category_label, item.description, item.source_text]
      .filter(Boolean)
      .join(" "),
  );
}

export function extractAvailableMinutes(query: string): number | undefined {
  const match = query.match(
    /\b(under|less\s+than|within|up\s+to|around|about|approximately|dưới|ít\s+hơn|trong\s+vòng|tối\s+đa|khoảng|tầm|xấp\s+xỉ|~)?\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|giờ|gio|phút|phut)\b/i,
  );
  if (!match) {
    const wordMatch = query.match(/\b(under|less\s+than|within|up\s+to|around|about|approximately|~)?\s*(half\s+an?|a[n]?|one)\s+hour\b/i);
    if (!wordMatch) return undefined;
    const amount = wordMatch[2].toLowerCase().startsWith("half") ? 0.5 : 1;
    const tolerance = /around|about|approximately|~/.test(wordMatch[1] ?? "") ? 30 : 0;
    return Math.round(amount * 60 + tolerance);
  }
  const amount = Number(match[2]);
  const unit = match[3].toLowerCase();
  const minutes = /^(?:hours?|hrs?|h|giờ|gio)$/i.test(unit) ? amount * 60 : amount;
  const tolerance = /around|about|approximately|khoảng|tầm|xấp\s+xỉ|~/i.test(match[1] ?? "") ? 30 : 0;
  return Math.round(minutes + tolerance);
}

/** Keep recommendation candidates inside an explicit request domain. */
export function filterRecommendationItems(items: Item[], query: string): Item[] {
  if (FOOD_QUERY_RE.test(query)) return items.filter(isFoodItem);
  return items;
}

/** Merge heuristic rank with vector hits (semantic boost). */
export function hybridRankCandidates(input: {
  intent: string;
  items: Item[];
  hits: RagHit[];
  availableMinutes?: number;
  query?: string;
}): RankedCandidate[] {
  const hitScore = new Map(
    input.hits.map((h) => [h.sourceId, h.score] as const),
  );

  const items = filterRecommendationItems(input.items, input.query ?? "");
  const base =
    input.intent === "LIST_ITEMS"
      ? items
          .filter((item) => item.status === "ACTIVE")
          .map((item) => ({ item, score: 0, reasons: [] as string[] }))
      : input.intent === "RECOMMEND_PLACE"
      ? rankPlaceCandidates(items, {
          availableMinutes: input.availableMinutes,
        })
      : input.intent === "RECOMMEND_TASK"
        ? rankTaskCandidates(items, {
            availableMinutes: input.availableMinutes,
          })
        : [
            ...rankTaskCandidates(items, {
              availableMinutes: input.availableMinutes,
            }),
            ...rankPlaceCandidates(items),
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
    query: input.query,
    availableMinutes: extractAvailableMinutes(input.query),
  });
  return { candidates, projectByItemId };
}
