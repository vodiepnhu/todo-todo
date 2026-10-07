import type { ItemEvent } from "@/types/database";
import { CATEGORY_LABELS, type Category } from "@/types/database";

export type HistoryEvent = ItemEvent & {
  items?: {
    title: string;
    category: string | null;
    category_label: string | null;
  } | null;
};

export function historyCategory(event: HistoryEvent): string {
  const label = event.items?.category_label?.trim();
  if (label) return label;

  const category = event.items?.category?.trim();
  if (category && category in CATEGORY_LABELS) {
    return CATEGORY_LABELS[category as Category];
  }
  return category || "Other";
}

export function historyCategories(events: HistoryEvent[]): string[] {
  return [...new Set(events.map(historyCategory))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function filterHistoryEvents(
  events: HistoryEvent[],
  filter: string,
): HistoryEvent[] {
  return filter === "ALL"
    ? events
    : events.filter((event) => historyCategory(event) === filter);
}
