import type {
  AuditLog,
  Item,
  ItemEvent,
  Place,
  PlanCost,
} from "@/types/database";

export type DashRange = "7" | "30" | "90" | "all";

export function sinceMs(range: DashRange, now = Date.now()): number {
  if (range === "all") return 0;
  return now - Number(range) * 86_400_000;
}

export function ymdInTz(date: Date, timeZone = "Australia/Sydney"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isOnSydneyDay(
  iso: string | null | undefined,
  day: Date = new Date(),
): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return ymdInTz(d) === ymdInTz(day);
}

export function filterTodayItems(items: Item[], now = new Date()): Item[] {
  return items.filter(
    (i) =>
      i.status === "ACTIVE" &&
      (isOnSydneyDay(i.due_at, now) || isOnSydneyDay(i.planned_start_at, now)),
  );
}

export function countOverdue(items: Item[], now = new Date()): number {
  const today = ymdInTz(now);
  return items.filter((i) => {
    if (i.status !== "ACTIVE" || !i.due_at) return false;
    const due = new Date(i.due_at);
    if (Number.isNaN(due.getTime())) return false;
    return ymdInTz(due) < today;
  }).length;
}

export function statusCounts(items: Item[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) {
    out[i.status] = (out[i.status] ?? 0) + 1;
  }
  return out;
}

export type DashboardProgress = {
  total: number;
  upcoming: number;
  visited: number;
  skipped: number;
};

export function planProgress(items: Item[]): DashboardProgress {
  const progress: DashboardProgress = {
    total: items.length,
    upcoming: 0,
    visited: 0,
    skipped: 0,
  };
  for (const item of items) {
    if (item.plan_status === "SKIPPED" || item.status === "ARCHIVED") {
      progress.skipped += 1;
    } else if (item.plan_status === "VISITED" || item.status === "COMPLETED") {
      progress.visited += 1;
    } else {
      progress.upcoming += 1;
    }
  }
  return progress;
}

export function nextDashboardItems(items: Item[], limit = 5): Item[] {
  return items
    .filter(
      (item) =>
        item.plan_status !== "VISITED" &&
        item.plan_status !== "SKIPPED" &&
        item.status !== "COMPLETED" &&
        item.status !== "ARCHIVED",
    )
    .sort((a, b) => {
      const aTime = a.due_at ?? a.planned_start_at;
      const bTime = b.due_at ?? b.planned_start_at;
      if (!aTime && !bTime) return a.updated_at.localeCompare(b.updated_at);
      if (!aTime) return 1;
      if (!bTime) return -1;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    })
    .slice(0, limit);
}

export function categoryCounts(items: Item[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const i of items) {
    if (i.status !== "ACTIVE") continue;
    const key = i.category_label || i.category || "Other";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function auditTrend(
  audits: AuditLog[],
  range: DashRange,
  now = Date.now(),
): { day: string; count: number }[] {
  const from = sinceMs(range, now);
  const buckets = new Map<string, number>();
  for (const a of audits) {
    const t = new Date(a.created_at).getTime();
    if (range !== "all" && t < from) continue;
    const key = ymdInTz(new Date(a.created_at));
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));
}

export function completionsOverTime(
  events: ItemEvent[],
  range: DashRange,
  now = Date.now(),
): { day: string; count: number }[] {
  const from = sinceMs(range, now);
  const buckets = new Map<string, number>();
  for (const e of events) {
    if (e.event_type !== "COMPLETED") continue;
    const t = new Date(e.occurred_at).getTime();
    if (range !== "all" && t < from) continue;
    const key = ymdInTz(new Date(e.occurred_at));
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayHeatmap(
  events: ItemEvent[],
  range: DashRange,
  now = Date.now(),
): { day: string; count: number }[] {
  const from = sinceMs(range, now);
  const counts = Array.from({ length: 7 }, () => 0);
  for (const e of events) {
    const t = new Date(e.occurred_at).getTime();
    if (range !== "all" && t < from) continue;
    // weekday in Sydney
    const wd = new Intl.DateTimeFormat("en-US", {
      timeZone: "Australia/Sydney",
      weekday: "short",
    }).format(new Date(e.occurred_at));
    const idx = WEEKDAYS.findIndex((d) => wd.startsWith(d.slice(0, 3)));
    if (idx >= 0) counts[idx]! += 1;
  }
  return WEEKDAYS.map((day, i) => ({ day, count: counts[i]! }));
}

export function durationHistogram(
  items: Item[],
  events: ItemEvent[],
): { bucket: string; estimated: number; actual: number }[] {
  const edges = [0, 30, 60, 120, 240, Infinity];
  const labels = ["0–30m", "30–60m", "1–2h", "2–4h", "4h+"];
  const estimated = labels.map(() => 0);
  const actual = labels.map(() => 0);

  function bucket(min: number | null): number | null {
    if (min == null || !Number.isFinite(min) || min < 0) return null;
    for (let i = 0; i < edges.length - 1; i++) {
      if (min >= edges[i]! && min < edges[i + 1]!) return i;
    }
    return labels.length - 1;
  }

  for (const i of items) {
    const b = bucket(i.estimated_duration_min);
    if (b != null) estimated[b]! += 1;
  }
  for (const e of events) {
    const b = bucket(e.actual_duration_min);
    if (b != null) actual[b]! += 1;
  }
  return labels.map((bucket, i) => ({
    bucket,
    estimated: estimated[i]!,
    actual: actual[i]!,
  }));
}

export function costByCategory(
  costs: PlanCost[],
): { category: string; estimated: number; actual: number }[] {
  const map = new Map<string, { estimated: number; actual: number }>();
  for (const c of costs) {
    const prev = map.get(c.category) ?? { estimated: 0, actual: 0 };
    prev.estimated += Number(c.estimated_amount) || 0;
    prev.actual += Number(c.actual_amount) || 0;
    map.set(c.category, prev);
  }
  return [...map.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.estimated - a.estimated);
}

export function totalEstimatedCost(costs: PlanCost[]): number {
  return costs.reduce((s, c) => s + (Number(c.estimated_amount) || 0), 0);
}

export function placesScatter(
  places: Place[],
): { name: string; lat: number; lng: number }[] {
  return places
    .filter(
      (p) =>
        p.latitude != null &&
        p.longitude != null &&
        Number.isFinite(p.latitude) &&
        Number.isFinite(p.longitude),
    )
    .map((p) => ({
      name: p.name,
      lat: p.latitude as number,
      lng: p.longitude as number,
    }));
}

export function memberCompare(
  audits: AuditLog[],
  events: ItemEvent[],
  range: DashRange,
  now = Date.now(),
): { actor: string; audits: number; events: number }[] {
  const from = sinceMs(range, now);
  const map = new Map<string, { audits: number; events: number }>();
  for (const a of audits) {
    const t = new Date(a.created_at).getTime();
    if (range !== "all" && t < from) continue;
    const id = a.actor_profile_id ?? "unknown";
    const prev = map.get(id) ?? { audits: 0, events: 0 };
    prev.audits += 1;
    map.set(id, prev);
  }
  for (const e of events) {
    const t = new Date(e.occurred_at).getTime();
    if (range !== "all" && t < from) continue;
    const id = e.recorded_by || "unknown";
    const prev = map.get(id) ?? { audits: 0, events: 0 };
    prev.events += 1;
    map.set(id, prev);
  }
  return [...map.entries()]
    .map(([actor, v]) => ({ actor: actor.slice(0, 8), ...v }))
    .sort((a, b) => b.audits + b.events - (a.audits + a.events));
}

export function eventsInRange(
  events: ItemEvent[],
  range: DashRange,
  now = Date.now(),
): number {
  const from = sinceMs(range, now);
  return events.filter((e) => {
    const t = new Date(e.occurred_at).getTime();
    return range === "all" || t >= from;
  }).length;
}
