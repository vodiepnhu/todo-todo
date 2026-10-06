"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { AddToPlanForm } from "@/components/plans/add-to-plan-form";
import { PlanSchema, emptyPlan } from "@/lib/plans/plan-schema";
import type { PlanDraft } from "@/lib/plans/plan-schema";
import { planToPendingPayload } from "@/lib/plans/plan-payload";
import { PlannerWaitPanel } from "@/components/ui/planner-wait-panel";

type Step = "compose" | "plan" | "extracting";

export function QuickAddModal({
  open,
  onClose,
  workspaceId,
  userId,
  initialText = "",
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  userId: string;
  /** Prefill compose / extract textarea when modal opens. */
  initialText?: string;
}) {
  const [step, setStep] = useState<Step>("compose");
  const [text, setText] = useState("");
  const [plan, setPlan] = useState<PlanDraft>(emptyPlan);
  const [planMissing, setPlanMissing] = useState<string[]>([]);
  const [planSuggested, setPlanSuggested] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setText(initialText);
      setPlan(emptyPlan());
      setPlanMissing([]);
      setPlanSuggested(false);
      setStep("compose");
    }
  }, [open, initialText]);

  if (!open) return null;

  async function runExtractPlan(fallback: Step = "compose") {
    if (!text.trim()) return;
    setBusy(true);
    setStep("extracting");
    try {
      const res = await fetch("/api/ai/extract-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          text: text.trim(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          lookupMaps: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Extract failed");
      setPlan(json.draft as PlanDraft);
      setPlanMissing((json.missing as string[]) ?? []);
      setPlanSuggested(true);
      setStep("plan");
      if (json.mocked) {
        toast.message("Drafted with mock model (no API key)");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Extract failed");
      setStep(fallback);
    } finally {
      setBusy(false);
    }
  }

  async function savePlan() {
    const cleaned = {
      ...plan,
      costs: plan.costs.filter((c) => c.category.trim().length > 0),
      todos: plan.todos.filter((t) => t.task.trim().length > 0),
    };
    const parsed = PlanSchema.safeParse(cleaned);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Place name required");
      return;
    }
    setBusy(true);
    try {
      const payload = planToPendingPayload(parsed.data, plan.sourceText);
      const supabase = createClient();
      const expires = new Date(Date.now() + 30 * 60_000).toISOString();
      const { data: pending, error } = await supabase
        .from("pending_actions")
        .insert({
          workspace_id: workspaceId,
          action_type: "CREATE",
          payload_json: payload,
          before_json: null,
          after_json: null,
          base_entity_version: null,
          initiated_by: userId,
          state: "AWAITING_CONFIRM_2",
          expires_at: expires,
        })
        .select("*")
        .single();
      if (error) throw error;
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId: pending.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Confirm failed");
      if (json.pending?.state !== "EXECUTED") {
        throw new Error("Confirm did not complete");
      }
      toast.success("Plan saved");
      window.dispatchEvent(new Event("planner:refresh"));
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <Card className="max-h-[90dvh] w-full max-w-lg space-y-3 overflow-y-auto p-5">
        {step === "extracting" && (
          <PlannerWaitPanel
            title="Planner is drafting your plan…"
            hint="Looking up Maps if needed"
          />
        )}

        {step === "plan" && (
          <AddToPlanForm
            value={plan}
            onChange={setPlan}
            onCancel={onClose}
            onSave={() => void savePlan()}
            busy={busy}
            missing={planMissing}
            suggested={planSuggested}
          />
        )}

        {step === "compose" && (
          <>
            <h2 className="text-lg font-semibold">What would you like to add?</h2>
            <Textarea
              autoFocus
              placeholder='e.g. "IKEA Tempe Saturday" or paste a Maps link'
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
              }}
            />
            <p className="text-xs text-muted">
              Planner fills the Add to Plan form (place, activities, prep,
              timing, notes) — edit before saving. Won&apos;t invent maps links
              or costs.
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => void runExtractPlan("compose")}
                  disabled={!text.trim() || busy}
                >
                  Continue with Planner
                </Button>
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPlan(emptyPlan());
                  setPlanMissing([]);
                  setPlanSuggested(false);
                  setStep("plan");
                }}
              >
                Add trip plan manually
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
