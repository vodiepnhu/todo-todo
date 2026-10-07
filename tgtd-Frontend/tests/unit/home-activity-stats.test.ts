import { describe, expect, it, vi } from "vitest";
import {
  activityAt,
  aggregateHomeActivityStats,
  dateKeyInTimeZone,
  listHomeActivityStats,
} from "@/lib/home-activity-stats";

describe("home-activity-stats", () => {
  it("activityAt prefers due_at over planned_start_at", () => {
    expect(
      activityAt({
        due_at: "2026-09-24T10:00:00+10:00",
        planned_start_at: "2026-09-24T12:00:00+10:00",
      }),
    ).toBe("2026-09-24T10:00:00+10:00");
    expect(
      activityAt({ due_at: null, planned_start_at: "2026-09-24T12:00:00+10:00" }),
    ).toBe("2026-09-24T12:00:00+10:00");
  });

  it("aggregates counts, next due, and today strip in Sydney", () => {
    const now = new Date("2026-09-24T08:00:00+10:00");
    const todayIso = "2026-09-24T09:00:00+10:00";
    const laterIso = "2026-09-25T09:00:00+10:00";
    const earlyToday = "2026-09-24T07:00:00+10:00";

    expect(dateKeyInTimeZone(now, "Australia/Sydney")).toBe("2026-09-24");

    const result = aggregateHomeActivityStats(
      [
        {
          id: "i1",
          workspace_id: "w1",
          title: "Bondi swim",
          due_at: todayIso,
          planned_start_at: null,
        },
        {
          id: "i2",
          workspace_id: "w1",
          title: "No date chore",
          due_at: null,
          planned_start_at: null,
        },
        {
          id: "i3",
          workspace_id: "w1",
          title: "Early coffee",
          due_at: earlyToday,
          planned_start_at: null,
        },
        {
          id: "i4",
          workspace_id: "w2",
          title: "Tomorrow hike",
          due_at: laterIso,
          planned_start_at: null,
        },
      ],
      { w1: "Sydney Weekends", w2: "City Errands" },
      now,
    );

    expect(result.byWorkspace.w1.activeCount).toBe(3);
    expect(result.byWorkspace.w1.next?.id).toBe("i3");
    expect(result.byWorkspace.w2.activeCount).toBe(1);
    expect(result.today.map((t) => t.id)).toEqual(["i3", "i1"]);
    expect(result.today[0]?.workspaceName).toBe("Sydney Weekends");
  });

  it("keeps visited items in home activity stats", async () => {
    const query = {} as Record<string, unknown> & {
      then: (resolve: (value: unknown) => unknown) => Promise<unknown>;
    };
    query.select = vi.fn(() => query);
    query.in = vi.fn(() => query);
    query.is = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.then = (resolve) =>
      Promise.resolve({
        data: [
          {
            id: "visited-1",
            workspace_id: "w1",
            title: "Visited place",
            due_at: null,
            planned_start_at: null,
            plan_status: "VISITED",
            category_label: null,
            estimated_duration_min: null,
          },
        ],
        error: null,
      }).then(resolve);

    const result = await listHomeActivityStats(
      { from: vi.fn(() => query) } as never,
      [{ id: "w1", name: "Weekend" }],
    );

    expect(result.activities).toHaveLength(1);
    expect(result.activities[0]?.planStatus).toBe("VISITED");
    expect(query.eq).not.toHaveBeenCalledWith("status", "ACTIVE");
  });
});
