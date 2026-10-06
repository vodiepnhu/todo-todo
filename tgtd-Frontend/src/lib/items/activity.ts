import type { EventType, ItemType, ItemSubtype } from "@/types/database";

/** Coerce legacy TODO/TOGO (and unknown) to ACTIVITY. */
export function coerceItemType(raw: unknown): ItemType {
  if (raw === "ACTIVITY" || raw === "TODO" || raw === "TOGO") return "ACTIVITY";
  return "ACTIVITY";
}

/** App always writes TASK; accept legacy subtypes. */
export function coerceSubtype(_raw?: unknown): ItemSubtype {
  return "TASK";
}

/** Done action uses COMPLETED; map legacy VISITED. */
export function coerceEventType(raw: unknown): EventType {
  if (raw === "VISITED" || raw === "TRIED") return "COMPLETED";
  if (
    raw === "COMPLETED" ||
    raw === "STARTED" ||
    raw === "SKIPPED" ||
    raw === "CANCELLED"
  ) {
    return raw;
  }
  return "COMPLETED";
}

export function itemHasPlace(item: {
  item_places?: { place_id?: string }[] | null;
  source_text?: string | null;
  description?: string | null;
}): boolean {
  if (item.item_places && item.item_places.length > 0) return true;
  const blob = `${item.source_text ?? ""} ${item.description ?? ""}`;
  return /maps\.google|goo\.gl\/maps|google\.com\/maps/i.test(blob);
}

/** Due soon: overdue or due within next `days` days. */
export function isDueSoon(
  dueAt: string | null | undefined,
  now = new Date(),
  days = 7,
): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return false;
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + days);
  return due.getTime() <= end.getTime();
}
