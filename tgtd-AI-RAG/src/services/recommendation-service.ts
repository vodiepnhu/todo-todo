import type { Item } from "../types/database";
import { itemHasPlace } from "../lib/items/activity";

export type RankedCandidate = {
  item: Item;
  score: number;
  reasons: string[];
};

/** Deterministic ranking before LLM explanation — all ACTIVE activities. */
export function rankTaskCandidates(
  items: Item[],
  opts: { availableMinutes?: number; now?: Date } = {},
): RankedCandidate[] {
  const now = opts.now ?? new Date();
  const available = opts.availableMinutes ?? 120;

  return items
    .filter((i) => i.status === "ACTIVE")
    .map((item) => {
      let score = 50;
      const reasons: string[] = [];
      if (item.due_at) {
        const due = new Date(item.due_at);
        const hours = (due.getTime() - now.getTime()) / 36e5;
        if (hours < 0) {
          score += 40;
          reasons.push("Overdue");
        } else if (hours < 24) {
          score += 30;
          reasons.push("Due soon");
        } else if (hours < 72) {
          score += 15;
          reasons.push("Due this week");
        }
      }
      if (item.priority != null) {
        score += Math.max(0, 5 - item.priority) * 5;
        reasons.push(`Priority ${item.priority}`);
      }
      const dur = item.estimated_duration_min ?? 45;
      if (dur <= available) {
        score += 20;
        reasons.push(`Fits ~${dur} min`);
      } else {
        score -= 15;
        reasons.push(`Needs ~${dur} min`);
      }
      return { item, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/** Prefer activities that look place-oriented (legacy TOGO + places). */
export function rankPlaceCandidates(items: Item[]): RankedCandidate[] {
  return items
    .filter((i) => i.status === "ACTIVE")
    .filter(
      (i) =>
        itemHasPlace({
          description: i.description,
          source_text: i.source_text,
        }) || i.plan_status != null,
    )
    .map((item) => {
      const reasons = ["From your activities"];
      let score = 40;
      if (item.planned_start_at) {
        score += 20;
        reasons.push("Already planned");
      }
      return { item, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
