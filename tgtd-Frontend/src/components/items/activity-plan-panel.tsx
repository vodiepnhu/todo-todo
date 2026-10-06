"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AddToPlanForm } from "@/components/plans/add-to-plan-form";
import { createClient } from "@/lib/supabase/client";
import {
  PlanSchema,
  emptyPlan,
  type Plan,
  type PlanDraft,
  type PlanStatus,
} from "@/lib/plans/plan-schema";
import { loadPlanDraft } from "@/services/plan-persist-service";
import type { Item } from "@/types/database";
import { cn } from "@/lib/utils";

export type EditItemModalMode = "view" | "edit";

export type ActivityPlanSave = {
  id: string;
  version: number;
  plan: Plan;
};

const PANEL_STATUSES: PlanStatus[] = ["PLANNING", "VISITED", "SKIPPED"];

function normalizePlanStatus(status: PlanStatus | null | undefined): PlanStatus {
  return status === "VISITED" || status === "SKIPPED" ? status : "PLANNING";
}

function statusLabel(status: PlanStatus): string {
  if (status === "VISITED") return "Visited";
  if (status === "SKIPPED") return "Skipped";
  return "Planning";
}

export function ActivityPlanPanel({
  item,
  mode,
  onModeChange,
  onSave,
  onClose,
  embedded = false,
  openedAs = "view",
  projectName,
  onDelete,
}: {
  item: Item;
  mode: EditItemModalMode;
  onModeChange: (mode: EditItemModalMode) => void;
  onSave: (payload: ActivityPlanSave) => void | Promise<void>;
  onClose?: () => void;
  embedded?: boolean;
  openedAs?: EditItemModalMode;
  projectName?: string | null;
  onDelete?: (item: Item) => void | Promise<void>;
}) {
  const [plan, setPlan] = useState<PlanDraft>(() => ({
    ...emptyPlan(),
    placeName: item.title,
  }));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const readOnly = mode === "view";
  const currentStatus = normalizePlanStatus(plan.status);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const supabase = createClient();
        const draft = await loadPlanDraft(supabase, item.id);
        if (!cancelled) setPlan(draft);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Could not load plan");
          setPlan({ ...emptyPlan(), placeName: item.title });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.id, item.title]);

  function enableEdit() {
    onModeChange("edit");
  }

  function cancelEdit() {
    void (async () => {
      try {
        const supabase = createClient();
        setPlan(await loadPlanDraft(supabase, item.id));
      } catch {
        /* keep current */
      }
      if (embedded || openedAs === "view") onModeChange("view");
      else onClose?.();
    })();
  }

  async function submit() {
    const parsed = PlanSchema.safeParse(plan);
    if (!parsed.success) {
      toast.error("Place name required");
      return;
    }
    setBusy(true);
    try {
      await onSave({
        id: item.id,
        version: item.version,
        plan: parsed.data,
      });
      onModeChange("view");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(next: PlanStatus) {
    const normalized = normalizePlanStatus(next);
    const nextPlan = { ...plan, status: normalized };
    setPlan(nextPlan);
    if (!readOnly) return;

    const parsed = PlanSchema.safeParse(nextPlan);
    if (!parsed.success) {
      toast.error("Place name required");
      return;
    }
    setBusy(true);
    try {
      await onSave({
        id: item.id,
        version: item.version,
        plan: parsed.data,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Status update failed");
      try {
        const supabase = createClient();
        setPlan(await loadPlanDraft(supabase, item.id));
      } catch {
        /* keep selected status */
      }
    } finally {
      setBusy(false);
    }
  }

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            {readOnly ? "Activity" : "Edit activity"}
          </p>
          <h2 className="text-lg font-semibold">
            {readOnly ? "Details" : "Edit then save"}
          </h2>
          {projectName ? (
            <p className="mt-1 text-xs font-medium text-foreground/60">
              {projectName}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <label className="sr-only" htmlFor={`item-status-${item.id}`}>
            Activity status
          </label>
          <select
            id={`item-status-${item.id}`}
            className="h-8 rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-foreground"
            data-testid={`item-status-${item.id}`}
            value={currentStatus}
            disabled={loading || busy}
            onChange={(e) => void changeStatus(e.target.value as PlanStatus)}
          >
            {PANEL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
          {onClose && !embedded ? (
            <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>
              Close
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading plan…</p>
      ) : (
        <AddToPlanForm
          value={plan}
          onChange={setPlan}
          onCancel={cancelEdit}
          onSave={() => void submit()}
          busy={busy}
          readOnly={readOnly}
          hideActions
          heading={readOnly ? "ACTIVITY" : "EDIT PLAN"}
        />
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {readOnly ? (
          <Button
            type="button"
            data-testid="edit-item-enable-edit"
            onClick={enableEdit}
            disabled={loading}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={cancelEdit}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="edit-item-save"
              onClick={() => void submit()}
              disabled={busy || loading}
            >
              Save
            </Button>
          </>
        )}
        {readOnly && onDelete ? (
          <Button
            type="button"
            variant="ghost"
            data-testid={`item-delete-${item.id}`}
            onClick={() => void onDelete(item)}
            disabled={loading || busy}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        ) : null}
        {embedded && onClose ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </Button>
        ) : null}
      </div>
    </>
  );

  if (embedded) {
    return <div className="space-y-4">{body}</div>;
  }

  return (
    <Card
      className={cn(
        "max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto p-5 shadow-xl",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {body}
    </Card>
  );
}
