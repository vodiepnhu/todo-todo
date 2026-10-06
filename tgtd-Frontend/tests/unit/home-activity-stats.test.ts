import { describe, expect, it } from "vitest";
import {
  activityAt,
  aggregateHomeActivityStats,
  dateKeyInTimeZone,
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
});
