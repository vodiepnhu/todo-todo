"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { HistoryClient } from "@/components/history/history-client";
import { ActivityIcon } from "@/components/items/activity-icon";
import type { Item, ItemEvent, PlanCost } from "@/types/database";
import {
  categoryCounts,
  countOverdue,
  eventsInRange,
  filterTodayItems,
  nextDashboardItems,
  planProgress,
  totalEstimatedCost,
  type DashRange,
} from "@/lib/dashboard/aggregates";
import { paths } from "@/lib/paths";
import { cn } from "@/lib/utils";
import { categoryPalette } from "@/lib/category-colors";
import { useLocale } from "@/lib/i18n";

function formatWhen(iso: string | null, locale: "en" | "vi"): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-AU", {
      timeZone: "Australia/Sydney",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function isOverdue(item: Item): boolean {
  if (item.status !== "ACTIVE" || !item.due_at) return false;
  const due = new Date(item.due_at).getTime();
  return Number.isFinite(due) && due < Date.now();
}

function rangeLabel(range: DashRange, vi: boolean): string {
  return range === "all"
    ? vi ? "toàn bộ thời gian" : "all time"
    : vi ? `${range} ngày qua` : `last ${range} days`;
}

export function DashboardClient({ workspaceId }: { workspaceId: string }) {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const [items, setItems] = useState<Item[]>([]);
  const [events, setEvents] = useState<ItemEvent[]>([]);
  const [costs, setCosts] = useState<PlanCost[]>([]);
  const [range, setRange] = useState<DashRange>("7");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const [{ data: itemData }, { data: eventData }] = await Promise.all([
        supabase
          .from("items")
          .select("*")
          .eq("workspace_id", workspaceId)
          .is("deleted_at", null),
        supabase
          .from("item_events")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("occurred_at", { ascending: false })
          .limit(400),
      ]);

      const itemRows = (itemData ?? []) as Item[];
      setItems(itemRows);
      setEvents((eventData ?? []) as ItemEvent[]);

      const ids = itemRows.map((item) => item.id);
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

  const progress = useMemo(() => planProgress(items), [items]);
  const todayItems = useMemo(() => filterTodayItems(items), [items]);
  const nextItems = useMemo(() => nextDashboardItems(items), [items]);
  const categories = useMemo(() => categoryCounts(items).slice(0, 6), [items]);
  const overdue = countOverdue(items);
  const periodEvents = eventsInRange(events, range);
  const estimatedCost = totalEstimatedCost(costs);
  const visitedPercent = progress.total
    ? Math.round((progress.visited / progress.total) * 100)
    : 0;

  return (
    <div className="space-y-6 pb-8">
      <header className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 p-5 shadow-[-8px_-8px_18px_rgba(255,255,255,0.95),8px_12px_24px_rgba(147,175,212,0.2)] sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary-soft/70 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-primary/70">
              {vi ? "Nhịp dự án" : "Project pulse"}
            </p>
            <h2 className="mt-1 font-heading text-3xl font-black tracking-tight text-foreground">
              {vi ? "Tổng quan" : "Dashboard"}
            </h2>
            <p className="mt-2 max-w-xl text-sm font-medium text-muted">
              {vi ? "Xem việc cần chú ý hôm nay, lịch sắp tới và tiến độ kế hoạch." : "See what needs attention today, what is next, and how your plan is moving."}
            </p>
          </div>
          <div className="flex gap-1.5 rounded-2xl bg-primary-soft/70 p-1" aria-label={vi ? "Khoảng thời gian tổng quan" : "Dashboard range"}>
            {(["7", "30", "90", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRange(value)}
                className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                  range === value
                    ? "bg-white text-primary shadow-sm"
                    : "text-muted hover:bg-white/70 hover:text-foreground"
                }`}
              >
                {value === "all" ? (vi ? "Tất cả" : "All") : `${value}${vi ? " ngày" : "d"}`}
              </button>
            ))}
          </div>
        </div>
      </header>

      {loading ? (
        <p className="text-sm font-medium text-muted">{vi ? "Đang tải tổng quan…" : "Loading dashboard…"}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={vi ? "Sắp tới" : "Up next"}
              value={String(progress.upcoming)}
              detail={overdue ? `${overdue} ${vi ? "quá hạn" : "overdue"}` : (vi ? "Không có việc quá hạn" : "Nothing overdue")}
              icon={<CalendarClock className="h-5 w-5" aria-hidden />}
              tone="sky"
            />
            <MetricCard
              label={vi ? "Đã ghé" : "Visited"}
              value={`${progress.visited}/${progress.total}`}
              detail={`${visitedPercent}% ${vi ? "kế hoạch" : "of your plan"}`}
              icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
              tone="emerald"
            />
            <MetricCard
              label={vi ? "Hôm nay" : "Today"}
              value={String(todayItems.length)}
              detail={todayItems.length ? (vi ? "Tiếp tục lịch hôm nay" : "Keep the day moving") : (vi ? "Lịch đang trống" : "Clear calendar")}
              icon={<ListChecks className="h-5 w-5" aria-hidden />}
              tone="amber"
            />
            <MetricCard
              label={vi ? "Hoạt động" : "Activity"}
              value={String(periodEvents)}
              detail={`${vi ? "sự kiện" : "events"} ${rangeLabel(range, vi)}`}
              icon={<Sparkles className="h-5 w-5" aria-hidden />}
              tone="violet"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <TrackCard
              title={vi ? "Hôm nay" : "Today"}
              subtitle={vi ? "Các quyết định tiếp theo nằm ở đây." : "Your next decisions live here."}
              action={
                <Link
                  href={paths.projectLists(workspaceId)}
                  className="inline-flex items-center gap-1 text-xs font-black text-primary hover:underline"
                >
                  {vi ? "Mở danh sách" : "Open list"} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            >
              {todayItems.length === 0 ? (
                <EmptyState icon={<Sparkles className="h-5 w-5" aria-hidden />} text={vi ? "Hôm nay chưa có kế hoạch." : "No plans for today."} />
              ) : (
                <div className="space-y-2.5">
                  {todayItems.slice(0, 5).map((item) => (
                    <ActivityRow key={item.id} item={item} />
                  ))}
                </div>
              )}
            </TrackCard>

            <TrackCard title={vi ? "Tiến độ kế hoạch" : "Plan progress"} subtitle={vi ? "Tóm tắt nhanh toàn bộ kế hoạch." : "A simple read on your whole plan."}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-4xl font-black tracking-tight text-foreground">{visitedPercent}%</p>
                  <p className="mt-1 text-xs font-bold text-muted">{vi ? "đã ghé hoặc hoàn tất" : "visited or completed"}</p>
                </div>
                <p className="text-right text-xs font-bold text-muted">
                  {progress.visited} {vi ? "xong" : "done"}<br />{vi ? "trên tổng số" : "of"} {progress.total} {vi ? "hoạt động" : "activities"}
                </p>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-primary-soft" aria-label={`${visitedPercent}% visited`}>
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${visitedPercent}%` }} />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <ProgressStat label={vi ? "Sắp tới" : "Upcoming"} value={progress.upcoming} tone="sky" />
                <ProgressStat label={vi ? "Đã ghé" : "Visited"} value={progress.visited} tone="emerald" />
                <ProgressStat label={vi ? "Bỏ qua" : "Skipped"} value={progress.skipped} tone="amber" />
              </div>
            </TrackCard>
          </div>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/70">{vi ? "Cấu trúc kế hoạch" : "Shape of your plan"}</p>
                <h3 className="mt-1 font-heading text-xl font-black tracking-tight">{vi ? "Theo danh mục" : "By category"}</h3>
              </div>
              <Link href={paths.projectLists(workspaceId)} className="text-xs font-black text-primary hover:underline">
                {vi ? "Xem mọi hoạt động" : "See all activities"}
              </Link>
            </div>
            {categories.length === 0 ? (
              <Card className="border-dashed p-6 text-sm font-medium text-muted">{vi ? "Thêm hoạt động để xem danh mục." : "Add an activity to see categories."}</Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => (
                  <Card key={category.name} className={cn("flex items-center justify-between gap-3 p-4 shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_6px_14px_rgba(147,175,212,0.16)]", categoryPalette(category.name).card)}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={cn("neu-inset flex h-10 w-10 shrink-0 items-center justify-center", categoryPalette(category.name).icon)}>
                        <ActivityIcon text={category.name} className="h-5 w-5" />
                      </span>
                      <span className="truncate text-sm font-black text-foreground">{category.name}</span>
                    </div>
                    <span className={cn("text-2xl font-black tabular-nums", categoryPalette(category.name).count)}>{category.count}</span>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <TrackCard title={vi ? "Sắp tới" : "Next up"} subtitle={vi ? "Hoạt động sắp tới, sắp theo thời gian." : "Upcoming activities, sorted by time."}>
              {nextItems.length === 0 ? (
                <EmptyState icon={<CheckCircle2 className="h-5 w-5" aria-hidden />} text={vi ? "Kế hoạch đang trống." : "Your plan is clear."} />
              ) : (
                <div className="space-y-2.5">
                  {nextItems.map((item) => (
                    <ActivityRow key={item.id} item={item} compact />
                  ))}
                </div>
              )}
            </TrackCard>

            <TrackCard title={vi ? "Tóm tắt nhanh" : "Quick insights"} subtitle={`${vi ? "Thông tin hữu ích cho" : "Useful context for"} ${rangeLabel(range, vi)}.`}>
              <div className="space-y-3">
                <InsightRow label={vi ? "Chi phí ước tính" : "Estimated cost"} value={formatCost(estimatedCost)} />
                <InsightRow label={vi ? "Quá hạn" : "Overdue"} value={String(overdue)} alert={overdue > 0} />
                <InsightRow label={vi ? "Bỏ qua" : "Skipped"} value={String(progress.skipped)} />
              </div>
            </TrackCard>
          </div>

          <section id="history" className="scroll-mt-20 space-y-3">
            <HistoryClient workspaceId={workspaceId} />
          </section>
        </>
      )}
    </div>
  );
}

function formatCost(value: number): string {
  return value === 0 ? "$0" : `$${value.toFixed(0)}`;
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone: "sky" | "emerald" | "amber" | "violet";
}) {
  const toneClass = {
    sky: "bg-sky-50 text-sky-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
  }[tone];

  return (
    <Card className="border-white/80 bg-white/85 p-4 shadow-[-5px_-5px_12px_rgba(255,255,255,0.95),5px_7px_16px_rgba(147,175,212,0.17)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">{label}</p>
          <p className="mt-2 text-3xl font-black tabular-nums text-foreground">{value}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${toneClass}`}>{icon}</span>
      </div>
      <p className="mt-2 text-xs font-bold text-muted">{detail}</p>
    </Card>
  );
}

function TrackCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-white/80 bg-white/85 p-5 shadow-[-7px_-7px_16px_rgba(255,255,255,0.95),7px_10px_20px_rgba(147,175,212,0.18)] sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-black tracking-tight text-foreground">{title}</h3>
          <p className="mt-1 text-xs font-medium text-muted">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function ActivityRow({ item, compact = false }: { item: Item; compact?: boolean }) {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const time = formatWhen(item.due_at ?? item.planned_start_at, locale);
  const overdue = isOverdue(item);
  const palette = categoryPalette(item.category_label ?? item.category ?? "");
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/75 ${compact ? "p-3" : "p-3.5"}`}>
      <span className={cn("neu-inset flex h-10 w-10 shrink-0 items-center justify-center", palette.icon)}>
        <ActivityIcon text={`${item.category_label ?? item.category ?? ""} ${item.title}`} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-foreground">{item.title}</p>
        <p className={`mt-1 flex items-center gap-1 text-xs font-bold ${overdue ? "text-rose-600" : "text-muted"}`}>
          {overdue ? <CircleAlert className="h-3.5 w-3.5" aria-hidden /> : <Clock3 className="h-3.5 w-3.5" aria-hidden />}
          {overdue ? (vi ? "Quá hạn" : "Overdue") : time ?? (vi ? "Chưa đặt giờ" : "No time set")}
        </p>
      </div>
      {item.category_label ? <span className={cn("hidden rounded-full border px-2.5 py-1 text-[10px] font-black sm:inline-flex", palette.badge)}>{item.category_label}</span> : null}
    </div>
  );
}

function ProgressStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "sky" | "emerald" | "amber";
}) {
  const dot = { sky: "bg-sky-400", emerald: "bg-emerald-500", amber: "bg-amber-400" }[tone];
  return (
    <div className="rounded-2xl bg-surface/80 p-3">
      <span className={`mb-2 block h-2 w-2 rounded-full ${dot}`} />
      <p className="text-lg font-black tabular-nums">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold text-muted">{label}</p>
    </div>
  );
}

function InsightRow({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <span className="text-sm font-bold text-muted">{label}</span>
      <span className={`text-lg font-black tabular-nums ${alert ? "text-rose-600" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface/60 p-4 text-sm font-bold text-muted">
      <span className="text-primary">{icon}</span>
      {text}
    </div>
  );
}
