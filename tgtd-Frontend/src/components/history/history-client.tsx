"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Badge } from "@/components/ui/card";
import {
  filterHistoryEvents,
  historyCategories,
  historyCategory,
  type HistoryEvent,
} from "@/lib/history-filters";

export function HistoryClient({ workspaceId }: { workspaceId: string }) {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [filter, setFilter] = useState<string>("ALL");

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("item_events")
      .select("*, items(title, category, category_label)")
      .eq("workspace_id", workspaceId)
      .order("occurred_at", { ascending: false })
      .limit(50);
    setEvents((data ?? []) as HistoryEvent[]);
  }

  useEffect(() => {
    void load();
    const supabase = createClient();
    const channel = supabase
      .channel(`events-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "item_events",
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

  const categories = historyCategories(events);
  const filtered = filterHistoryEvents(events, filter);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">History</h3>
      <div className="flex flex-wrap gap-2">
        {["ALL", ...categories].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1 text-xs ${
              filter === f ? "bg-cta text-white" : "bg-primary-soft"
            }`}
          >
            {f === "ALL" ? "All" : f}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <Card className="text-sm text-muted">
          No activity history yet.
        </Card>
      ) : (
        filtered.map((e) => (
          <Card key={e.id} className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium">
                {(e.items as { title?: string } | null)?.title ?? "Item"}
              </p>
              <p className="text-xs text-muted">
                {new Date(e.occurred_at).toLocaleString()}
                {e.note ? ` · ${e.note}` : ""}
              </p>
            </div>
            <Badge>{historyCategory(e)}</Badge>
          </Card>
        ))
      )}
    </div>
  );
}
