"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { HistoryClient } from "@/components/history/history-client";
import type {
  AuditLog,
  Item,
  ItemEvent,
  Place,
  PlanCost,
} from "@/types/database";
import {
  auditTrend,
  categoryCounts,
  completionsOverTime,
  costByCategory,
  countOverdue,
  durationHistogram,
  eventsInRange,
  filterTodayItems,
  memberCompare,
  placesScatter,
  statusCounts,
  totalEstimatedCost,
  weekdayHeatmap,
  type DashRange,
} from "@/lib/dashboard/aggregates";
import { paths } from "@/lib/paths";

const ChartPulse = () => (
  <div className="h-48 animate-pulse rounded-xl bg-primary-soft" />
);

const StatusDonut = dynamic(
  () => import("@/components/dashboard/dashboard-charts").then((m) => m.StatusDonut),
  { ssr: false, loading: ChartPulse },
);
const CategoryBar = dynamic(
  () => import("@/components/dashboard/dashboard-charts").then((m) => m.CategoryBar),
  { ssr: false, loading: ChartPulse },
);
const SimpleTrend = dynamic(
  () => import("@/components/dashboard/dashboard-charts").then((m) => m.SimpleTrend),
  { ssr: false, loading: ChartPulse },
);
const WeekdayBars = dynamic(
  () => import("@/components/dashboard/dashboard-charts").then((m) => m.WeekdayBars),
  { ssr: false, loading: ChartPulse },
);
const DurationBars = dynamic(
  () => import("@/components/dashboard/dashboard-charts").then((m) => m.DurationBars),
  { ssr: false, loading: ChartPulse },
);
const CostBars = dynamic(
  () => import("@/components/dashboard/dashboard-charts").then((m) => m.CostBars),
  { ssr: false, loading: ChartPulse },
);
const PlacesScatter = dynamic(
  () => import("@/components/dashboard/dashboard-charts").then((m) => m.PlacesScatter),
  { ssr: false, loading: ChartPulse },
);
const MemberBars = dynamic(
  () => import("@/components/dashboard/dashboard-charts").then((m) => m.MemberBars),
  { ssr: false, loading: ChartPulse },
);

function fmtUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(0)}`;
}

export function DashboardClient({ workspaceId }: { workspaceId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [events, setEvents] = useState<ItemEvent[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [costs, setCosts] = useState<PlanCost[]>([]);
  const [range, setRange] = useState<DashRange>("7");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const [{ data: itemData }, { data: auditData }, { data: eventData }, { data: placeData }] =
        await Promise.all([
          supabase
            .from("items")
            .select("*")
            .eq("workspace_id", workspaceId)
            .is("deleted_at", null),
          supabase
            .from("audit_logs")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(400),
          supabase
            .from("item_events")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("occurred_at", { ascending: false })
            .limit(400),
          supabase.from("places").select("*").eq("workspace_id", workspaceId),
        ]);
      const itemRows = (itemData ?? []) as Item[];
      setItems(itemRows);
      setAudits((auditData ?? []) as AuditLog[]);
      setEvents((eventData ?? []) as ItemEvent[]);
      setPlaces((placeData ?? []) as Place[]);

      const ids = itemRows.map((i) => i.id);
      if (ids.length > 0) {
        const { data: costData } = await supabase
          .from("plan_costs")
          .select("*")
          .in("item_id", ids);
        setCosts((costData ?? []) as PlanCost[]);
      } else {
        setCosts([]);
      }
      setLoading(false);
    }
    void load();
    const onRefresh = () => void load();
    window.addEventListener("planner:refresh", onRefresh);
    return () => window.removeEventListener("planner:refresh", onRefresh);
  }, [workspaceId]);

  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading]);

  const active = items.filter((i) => i.status === "ACTIVE");
  const completed = items.filter((i) => i.status === "COMPLETED");
  const overdue = countOverdue(items);
  const eventCount = eventsInRange(events, range);
  const estCost = totalEstimatedCost(costs);
  const todayItems = useMemo(() => filterTodayItems(items), [items]);

  const statusData = useMemo(() => {
    const c = statusCounts(items);
    return Object.entries(c).map(([name, value]) => ({ name, value }));
  }, [items]);

  const cats = useMemo(() => categoryCounts(items), [items]);
  const trend = useMemo(() => auditTrend(audits, range), [audits, range]);
  const comps = useMemo(
    () => completionsOverTime(events, range),
    [events, range],
  );
  const weekdays = useMemo(() => weekdayHeatmap(events, range), [events, range]);
  const durations = useMemo(
    () => durationHistogram(items, events),
    [items, events],
  );
  const costData = useMemo(() => costByCategory(costs), [costs]);
  const scatter = useMemo(() => placesScatter(places), [places]);
  const members = useMemo(
    () => memberCompare(audits, events, range),
    [audits, events, range],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <div className="flex gap-1">
          {(["7", "30", "90", "all"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-lg px-2 py-1 text-xs ${
                range === r ? "bg-cta text-white" : "bg-primary-soft"
              }`}
            >
              {r === "all" ? "All time" : `${r}d`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi label="Active" value={String(active.length)} />
            <Kpi label="Completed" value={String(completed.length)} />
            <Kpi label="Overdue" value={String(overdue)} />
            <Kpi label="Events" value={String(eventCount)} />
            <Kpi label="Est. cost" value={fmtUsd(estCost)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Status">
              <StatusDonut data={statusData} />
            </ChartCard>
            <ChartCard title="Category (active)">
              <CategoryBar data={cats} />
            </ChartCard>
            <ChartCard title="Audit activity trend">
              <SimpleTrend data={trend} />
            </ChartCard>
            <ChartCard title="Completions over time">
              <SimpleTrend data={comps} />
            </ChartCard>
            <ChartCard title="Events by weekday">
              <WeekdayBars data={weekdays} />
            </ChartCard>
            <ChartCard title="Duration">
              <DurationBars data={durations} />
            </ChartCard>
            <ChartCard title="Cost by category">
              <CostBars data={costData} />
            </ChartCard>
            <ChartCard title="Places (lat/lng)">
              <PlacesScatter data={scatter} />
            </ChartCard>
            <ChartCard title="Member activity" className="md:col-span-2">
              <MemberBars data={members} />
            </ChartCard>
          </div>

          <section id="today" className="scroll-mt-20 space-y-3">
            <div className="flex items-end justify-between gap-2">
              <h3 className="text-lg font-semibold">Today</h3>
              <Link
                href={paths.projectLists(workspaceId)}
                className="text-xs text-primary underline"
              >
                Open Lists
              </Link>
            </div>
            {todayItems.length === 0 ? (
              <Card className="text-sm text-muted">
                Nothing due or planned for today.
              </Card>
            ) : (
              <ul className="space-y-2">
                {todayItems.map((i) => (
                  <Card key={i.id} className="flex items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{i.title}</p>
                      <p className="text-[11px] text-muted">
                        {i.category_label || i.category || "Activity"}
                        {i.due_at ? ` · due ${new Date(i.due_at).toLocaleString()}` : ""}
                      </p>
                    </div>
                  </Card>
                ))}
              </ul>
            )}
          </section>

          <section id="history" className="scroll-mt-20 space-y-3">
            <HistoryClient workspaceId={workspaceId} />
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <Card className={className}>
      <p className="mb-2 text-sm font-medium">{title}</p>
      {children}
    </Card>
  );
}
