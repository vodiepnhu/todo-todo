/** Reciprocal Rank Fusion — merge ranked lists without score calibration. */
export function reciprocalRankFusion<T extends { id: string }>(
  lists: T[][],
  opts?: { k?: number; weights?: number[] },
): { id: string; score: number; item: T }[] {
  const k = opts?.k ?? 60;
  const weights = opts?.weights;
  const scores = new Map<string, { score: number; item: T }>();

  lists.forEach((list, li) => {
    const w = weights?.[li] ?? 1;
    list.forEach((item, rank) => {
      const add = w / (k + rank + 1);
      const prev = scores.get(item.id);
      if (prev) {
        prev.score += add;
      } else {
        scores.set(item.id, { score: add, item });
      }
    });
  });

  return [...scores.entries()]
    .map(([id, v]) => ({ id, score: v.score, item: v.item }))
    .sort((a, b) => b.score - a.score);
}

export type RagMetaFilters = {
  itemType?: "ACTIVITY" | null;
  tag?: string | null;
};

/** Lightweight query → metadata filters (no LLM). */
export function parseRagMetaFilters(query: string): RagMetaFilters {
  const q = query.toLowerCase();
  // All items are activities — do not filter by legacy TODO/TOGO.
  const itemType: RagMetaFilters["itemType"] = null;

  const tagMatch = q.match(
    /\b(beach|cafe|hiking|outdoor|food|chill|date|nature|indoor)\b/,
  );
  return { itemType, tag: tagMatch?.[1] ?? null };
}
