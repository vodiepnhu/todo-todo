import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanStatus } from "@/types/database";

export type HomeActivityNext = {
  id: string;
  title: string;
  at: string;
};

export type HomeWorkspaceStat = {
  activeCount: number;
  next: HomeActivityNext | null;
};

export type HomeTodayItem = {
  id: string;
  title: string;
  at: string;
  workspaceId: string;
  workspaceName: string;
};

export type HomeActivityStats = {
  byWorkspace: Record<string, HomeWorkspaceStat>;
  today: HomeTodayItem[];
  activities: HomeActivityItem[];
};

export type HomeActivityItem = {
  id: string;
  title: string;
  workspaceName: string;
  at: string | null;
  planStatus: PlanStatus | null;
  categoryLabel: string | null;
  estimatedDurationMin: number | null;
};

export type HomeActivityRow = {
  id: string;
  workspace_id: string;
  title: string;
  due_at: string | null;
  planned_start_at: string | null;
  plan_status?: PlanStatus | null;
  category_label?: string | null;
  estimated_duration_min?: number | null;
};

/** Calendar YYYY-MM-DD in a timezone. */
export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function activityAt(row: {
  due_at: string | null;
  planned_start_at: string | null;
}): string | null {
  return row.due_at ?? row.planned_start_at ?? null;
}

/** Pure aggregate — unit-tested. */
export function aggregateHomeActivityStats(
  rows: HomeActivityRow[],
  workspaceNames: Record<string, string>,
  now = new Date(),
  timeZone = "Australia/Sydney",
  todayLimit = 5,
): HomeActivityStats {
  const todayKey = dateKeyInTimeZone(now, timeZone);
  const byWorkspace: Record<string, HomeWorkspaceStat> = {};
  const todayCandidates: HomeTodayItem[] = [];
  const activities: HomeActivityItem[] = [];

  for (const row of rows) {
    const ws = row.workspace_id;
    const slot = byWorkspace[ws] ?? { activeCount: 0, next: null };
    slot.activeCount += 1;

    const at = activityAt(row);
    activities.push({
      id: row.id,
      title: row.title,
      workspaceName: workspaceNames[ws] ?? "Project",
      at,
      planStatus: row.plan_status ?? null,
      categoryLabel: row.category_label ?? null,
      estimatedDurationMin: row.estimated_duration_min ?? null,
    });
    if (at) {
      const atDate = new Date(at);
      if (!Number.isNaN(atDate.getTime())) {
        if (
          !slot.next ||
          atDate.getTime() < new Date(slot.next.at).getTime()
        ) {
          slot.next = { id: row.id, title: row.title, at };
        }
        if (dateKeyInTimeZone(atDate, timeZone) === todayKey) {
          todayCandidates.push({
            id: row.id,
            title: row.title,
            at,
            workspaceId: ws,
            workspaceName: workspaceNames[ws] ?? "Project",
          });
        }
      }
    }

    byWorkspace[ws] = slot;
  }

  todayCandidates.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
  activities.sort((a, b) => {
    if (!a.at && !b.at) return a.title.localeCompare(b.title);
    if (!a.at) return 1;
    if (!b.at) return -1;
    return new Date(a.at).getTime() - new Date(b.at).getTime();
  });

  return {
    byWorkspace,
    today: todayCandidates.slice(0, todayLimit),
    activities,
  };
}

export async function listHomeActivityStats(
  supabase: SupabaseClient,
  workspaces: Array<{ id: string; name: string }>,
  now = new Date(),
): Promise<HomeActivityStats> {
  if (workspaces.length === 0) {
    return { byWorkspace: {}, today: [], activities: [] };
  }

  const ids = workspaces.map((w) => w.id);
  const names = Object.fromEntries(workspaces.map((w) => [w.id, w.name]));

  const { data, error } = await supabase
    .from("items")
    .select(
      "id, workspace_id, title, due_at, planned_start_at, plan_status, category_label, estimated_duration_min",
    )
    .in("workspace_id", ids)
    .is("deleted_at", null);

  if (error) throw error;

  return aggregateHomeActivityStats(
    (data ?? []) as HomeActivityRow[],
    names,
    now,
  );
}
