"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
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

const FILTERS: ListFilter[] = ["All", "Upcoming", "Visited"];

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
    await startConfirm({
      actionType: "DELETE",
      payload: { id: item.id, version: item.version, title: item.title },
      baseVersion: item.version,
      previewTitle: "Delete item",
      previewBody: item.title,
    });
    if (selectedId === item.id) {
      setSelectedId(null);
    }
    await load();
  }

  async function saveEdit(payload: ActivityPlanSave) {
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
            {f}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card className="text-sm text-muted">No activities yet.</Card>
        ) : (
          filtered.map((item) => {
            const isOpen = selectedId === item.id;
            const isVisited =
              item.plan_status === "VISITED" || visitedIds.has(item.id);
            return (
              <Card
                key={item.id}
                className={cn(
                  "py-3 transition-colors",
                  isVisited &&
                    "border-emerald-200 bg-emerald-50/80 text-emerald-950",
                  isOpen && "ring-2 ring-primary/40",
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-3 rounded-lg px-1 text-left text-sm font-medium leading-5 transition hover:bg-primary-soft/50"
                  onClick={() => toggleItem(item)}
                  aria-expanded={isOpen}
                  data-testid={`item-open-${item.id}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="break-words">{item.title}</span>
                    {isVisited ? (
                      <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                        Visited
                      </span>
                    ) : null}
                  </span>
                  <ChevronDown
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform",
                      isOpen && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>

                {isOpen ? (
                  <div className="mt-4 border-t border-border/70 pt-4">
                    <ActivityPlanPanel
                      item={item}
                      mode={formMode}
                      onModeChange={setFormMode}
                      onSave={saveEdit}
                      onDelete={remove}
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
