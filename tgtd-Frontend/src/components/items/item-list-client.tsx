"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Calendar, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/confirmations/confirm-provider";
import {
  ActivityPlanPanel,
  type ActivityPlanSave,
  type EditItemModalMode,
} from "@/components/items/activity-plan-panel";
import { updatePlan } from "@/services/plan-persist-service";
import type { Item } from "@/types/database";
import {
  filterListItems,
  type ListFilter,
} from "@/lib/items/list-filters";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useWorkspaceAccess } from "@/components/workspace/workspace-layout-client";
import { useLocale } from "@/lib/i18n";
import { ActivityIcon } from "@/components/items/activity-icon";

const FILTERS: ListFilter[] = ["All", "Upcoming", "Visited"];

function formatItemWhen(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en-AU", {
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

type ListItem = Item & {
  item_places?: { place_id: string }[] | null;
};

export function ItemListClient({
  workspaceId,
  title,
}: {
  workspaceId: string;
  title: string;
}) {
  const { startConfirm } = useConfirm();
  const { canEdit, canDelete } = useWorkspaceAccess();
  const { locale } = useLocale();
  const vi = locale === "vi";
  const [items, setItems] = useState<ListItem[]>([]);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ListFilter>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<EditItemModalMode>("view");

  async function load() {
    const supabase = createClient();
    const [{ data }, { data: events }] = await Promise.all([
      supabase
        .from("items")
        .select("*, item_places(place_id)")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false }),
      supabase
        .from("item_events")
        .select("item_id")
        .eq("workspace_id", workspaceId)
        .eq("event_type", "VISITED"),
    ]);
    setItems((data ?? []) as ListItem[]);
    setVisitedIds(new Set((events ?? []).map((e) => e.item_id as string)));
  }

  useEffect(() => {
    void load();
    const supabase = createClient();
    const channel = supabase
      .channel(`items-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "items",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => void load(),
      )
      .subscribe();
    const onRefresh = () => void load();
    window.addEventListener("planner:refresh", onRefresh);
    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("planner:refresh", onRefresh);
    };
  }, [workspaceId]);

  const filtered = useMemo(
    () => filterListItems(items, filter, visitedIds),
    [items, filter, visitedIds],
  );

  function toggleItem(item: ListItem) {
    if (selectedId === item.id) {
      setSelectedId(null);
      setFormMode("view");
      return;
    }
    setSelectedId(item.id);
    setFormMode("view");
  }

  async function remove(item: Item) {
    if (!canDelete) return;
    await startConfirm({
      actionType: "DELETE",
      payload: { id: item.id, version: item.version, title: item.title },
      baseVersion: item.version,
      previewTitle: vi ? "Xóa hoạt động" : "Delete item",
      previewBody: item.title,
    });
    if (selectedId === item.id) {
      setSelectedId(null);
    }
    await load();
  }

  async function saveEdit(payload: ActivityPlanSave) {
    if (!canEdit) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    try {
      await updatePlan(supabase, payload.id, payload.plan, {
        expectedVersion: payload.version,
        userId: user?.id ?? null,
      });
      toast.success("Saved");
      window.dispatchEvent(new Event("planner:refresh"));
      await load();
      setFormMode("view");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      if (
        e instanceof Error &&
        e.message.includes("changed elsewhere")
      ) {
        setSelectedId(null);
        await load();
      }
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            data-testid={`list-filter-${f.toLowerCase()}`}
          >
            {vi ? ({ All: "Tất cả", Upcoming: "Sắp tới", Visited: "Đã thực hiện" }[f] ?? f) : f}
          </Button>
        ))}
      </div>

      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <Card className="rounded-2xl border border-dashed border-border bg-surface/70 p-6 text-center text-sm font-medium text-muted">
            {vi ? "Chưa có hoạt động nào trong mục này." : "No activities yet."}
          </Card>
        ) : (
          filtered.map((item) => {
            const isOpen = selectedId === item.id;
            const isSkipped = item.plan_status === "SKIPPED";
            const isVisited =
              item.plan_status === "VISITED" || visitedIds.has(item.id);
            const whenFormatted = formatItemWhen(item.planned_start_at);

            return (
              <Card
                key={item.id}
                className={cn(
                  "rounded-2xl border p-4.5 transition-all duration-200",
                  isSkipped &&
                    "border-amber-200/80 bg-amber-50/70 text-amber-950 shadow-[-2px_-2px_8px_rgba(255,255,255,0.9),2px_3px_10px_rgba(245,158,11,0.15)]",
                  !isSkipped &&
                    isVisited &&
                    "border-emerald-200/80 bg-emerald-50/70 text-emerald-950 shadow-[-2px_-2px_8px_rgba(255,255,255,0.9),2px_3px_10px_rgba(16,185,129,0.15)]",
                  !isSkipped &&
                    !isVisited &&
                    "border-white/80 bg-white/95 shadow-[-3px_-3px_10px_rgba(255,255,255,0.95),3px_5px_15px_rgba(147,175,212,0.2)] hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-[-4px_-4px_14px_rgba(255,255,255,1),4px_7px_18px_rgba(147,175,212,0.28)]",
                  isOpen && "ring-2 ring-primary/40 shadow-lg",
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-3.5 rounded-lg text-left text-sm font-medium leading-5 transition"
                  onClick={() => toggleItem(item)}
                  aria-expanded={isOpen}
                  data-testid={`item-open-${item.id}`}
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary-soft/90 text-primary shadow-xs">
                    <ActivityIcon
                      text={`${item.category_label ?? item.category ?? ""} ${item.title}`}
                      className="h-4.5 w-4.5"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-heading text-sm sm:text-base font-bold break-words text-foreground">
                        {item.title}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isSkipped ? (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 shadow-xs">
                            {vi ? "Đã bỏ qua" : "Skipped"}
                          </span>
                        ) : isVisited ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 shadow-xs">
                            <CheckCircle2 className="h-3 w-3" />
                            {vi ? "Đã thực hiện" : "Visited"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-800 shadow-xs">
                            {vi ? "Đang lên kế hoạch" : "Planning"}
                          </span>
                        )}
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-muted transition-transform",
                            isOpen && "rotate-180",
                          )}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                    {whenFormatted ? (
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-foreground/65">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        <span>{whenFormatted}</span>
                      </p>
                    ) : null}
                  </div>
                </button>

                {isOpen ? (
                  <div className="mt-4 border-t border-border/70 pt-4">
                    <ActivityPlanPanel
                      item={item}
                      mode={formMode}
                      onModeChange={setFormMode}
                      onSave={saveEdit}
                      onDelete={canDelete ? remove : undefined}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      embedded
                      openedAs={formMode}
                    />
                  </div>
                ) : null}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
