"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  CircleOff,
  Clock3,
  MapPin,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HomeActivityItem } from "@/lib/home-activity-stats";
import { ActivityIcon } from "@/components/items/activity-icon";

type ActivityFilter = "all" | "upcoming" | "visited" | "skipped";

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

function durationLabel(minutes: number | null): string | null {
  if (!minutes || minutes < 1) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}${rest ? `h ${rest}m` : "h"}` : `${minutes}m`;
}

export function HomePlacesSection({
  activities,
  locale,
  onAdd,
  onOpen,
}: {
  activities: HomeActivityItem[];
  locale: "en" | "vi";
  onAdd: () => void;
  onOpen: (activity: HomeActivityItem) => void;
}) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const vi = locale === "vi";
  const counts = useMemo(
    () => ({
      all: activities.length,
      upcoming: activities.filter(
        (item) => item.planStatus !== "VISITED" && item.planStatus !== "SKIPPED",
      ).length,
      visited: activities.filter((item) => item.planStatus === "VISITED").length,
      skipped: activities.filter((item) => item.planStatus === "SKIPPED").length,
    }),
    [activities],
  );
  const visibleActivities = useMemo(
    () =>
      activities.filter((item) =>
        filter === "all"
          ? true
          : filter === "visited"
          ? item.planStatus === "VISITED"
            : filter === "skipped"
              ? item.planStatus === "SKIPPED"
              : item.planStatus !== "VISITED" && item.planStatus !== "SKIPPED",
      ),
    [activities, filter],
  );
  const displayedActivities = showAll
    ? visibleActivities
    : visibleActivities.slice(0, 5);

  const filters: Array<{ id: ActivityFilter; label: string; count: number }> = [
    { id: "all", label: vi ? "Tất cả" : "All", count: counts.all },
    { id: "upcoming", label: vi ? "Sắp tới" : "Upcoming", count: counts.upcoming },
    { id: "visited", label: vi ? "Đã ghé thăm" : "Visited", count: counts.visited },
    { id: "skipped", label: vi ? "Đã bỏ qua" : "Skipped", count: counts.skipped },
  ];

  return (
    <section className="space-y-3" data-testid="home-places-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold tracking-tight text-foreground">
          <MapPin className="h-5 w-5 text-primary" aria-hidden />
          {vi ? "Địa điểm & Hoạt động" : "Places & Activities"}
        </h2>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="home-places-add"
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {vi ? "Thêm địa điểm" : "Add place"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={vi ? "Lọc hoạt động" : "Activity filters"}>
        {filters.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={filter === option.id}
            onClick={() => {
              setFilter(option.id);
              setShowAll(false);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-bold shadow-xs transition ${
              filter === option.id
                ? "bg-white text-primary shadow-[-2px_-2px_6px_rgba(255,255,255,0.95),2px_3px_8px_rgba(147,175,212,0.2)]"
                : "text-muted hover:bg-white/70 hover:text-foreground"
            }`}
          >
            {option.label} ({option.count})
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {visibleActivities.length === 0 ? (
          <div className="neu-card border-dashed p-6 text-center text-sm font-medium text-muted">
            {vi ? "Chưa có hoạt động trong mục này." : "No activities in this view."}
          </div>
        ) : (
          displayedActivities.map((activity) => {
            const visited = activity.planStatus === "VISITED";
            const skipped = activity.planStatus === "SKIPPED";
            const when = formatWhen(activity.at, locale);
            const duration = durationLabel(activity.estimatedDurationMin);

            return (
              <button
                type="button"
                key={activity.id}
                data-testid={`home-place-activity-${activity.id}`}
                aria-label={vi ? `Mở ${activity.title}` : `Open ${activity.title}`}
                onClick={() => onOpen(activity)}
                className="neu-card flex w-full flex-col gap-3 p-4 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="neu-inset flex h-10 w-10 shrink-0 items-center justify-center text-primary">
                    <ActivityIcon
                      text={`${activity.categoryLabel ?? ""} ${activity.title}`}
                      className="h-4.5 w-4.5"
                    />
                  </span>
                  <div className="min-w-0">
                    <h3 className="break-words font-heading text-sm font-bold text-foreground">
                      {activity.title}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted">
                      <span>{activity.workspaceName}</span>
                      {activity.categoryLabel ? <><span aria-hidden>·</span><span>{activity.categoryLabel}</span></> : null}
                      {duration ? <><span aria-hidden>·</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" aria-hidden />{duration}</span></> : null}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    visited
                      ? "bg-emerald-100 text-emerald-700"
                      : skipped
                        ? "bg-amber-100 text-amber-700"
                        : "bg-primary-soft text-primary"
                  }`}>
                    {visited ? (
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                    ) : skipped ? (
                      <CircleOff className="h-3 w-3" aria-hidden />
                    ) : (
                      <CalendarClock className="h-3 w-3" aria-hidden />
                    )}
                    {visited
                      ? (vi ? "Đã ghé thăm" : "Visited")
                      : skipped
                        ? (vi ? "Đã bỏ qua" : "Skipped")
                        : (vi ? "Đang lên kế hoạch" : "Planning")}
                  </span>
                  {when ? <time className="text-xs font-extrabold text-primary">{when}</time> : null}
                </div>
              </button>
            );
          })
        )}
      </div>

      {visibleActivities.length > 5 ? (
        <button
          type="button"
          data-testid="home-places-toggle"
          aria-expanded={showAll}
          onClick={() => setShowAll((current) => !current)}
          className="w-full rounded-xl py-2 text-xs font-bold text-primary transition hover:bg-primary-soft/60"
        >
          {showAll
            ? (vi ? "Thu gọn" : "Show less")
            : (vi ? `Xem tất cả (${visibleActivities.length})` : `See all (${visibleActivities.length})`)}
        </button>
      ) : null}
    </section>
  );
}
