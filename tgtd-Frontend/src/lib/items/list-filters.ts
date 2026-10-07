import type { Item } from "@/types/database";
import { ymdInTz } from "@/lib/dashboard/aggregates";

export type ListFilter = "All" | "Upcoming" | "Visited" | "Skipped";

function dateOnOrAfterSydneyToday(
  iso: string | null | undefined,
  now: Date,
): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return ymdInTz(d) >= ymdInTz(now);
}

/** ACTIVE + due or planned start on/after Sydney calendar today. */
export function isUpcomingItem(item: Item, now = new Date()): boolean {
  if (item.status !== "ACTIVE") return false;
  return (
    dateOnOrAfterSydneyToday(item.due_at, now) ||
    dateOnOrAfterSydneyToday(item.planned_start_at, now)
  );
}

export function filterListItems(
  items: Item[],
  filter: ListFilter,
  visitedIds: Set<string>,
  now = new Date(),
): Item[] {
  return items.filter((item) => {
    if (item.status === "ARCHIVED" && item.plan_status !== "SKIPPED") {
      return false;
    }
    const visited = item.plan_status === "VISITED" || visitedIds.has(item.id);
    if (filter === "All") return true;
    if (filter === "Upcoming") return isUpcomingItem(item, now);
    if (filter === "Visited") return visited;
    if (filter === "Skipped") return item.plan_status === "SKIPPED";
    return true;
  });
}
