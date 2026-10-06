import type { Plan, PlanDraft } from "@/lib/plans/plan-schema";
import { planStatusToItemStatus } from "@/lib/plans/plan-schema";

export function notesTextFromPlan(plan: Pick<PlanDraft, "notes">): string {
  const general = plan.notes.filter((n) => n.type === "general");
  if (general.length === 0) return plan.notes.map((n) => n.content).join("\n");
  return general.map((n) => n.content).join("\n\n");
}

export function applyNotesText(plan: PlanDraft, text: string): PlanDraft {
  const trimmed = text.trim();
  return {
    ...plan,
    notes: trimmed ? [{ type: "general", content: trimmed }] : [],
  };
}

export function planToPendingPayload(
  plan: Plan,
  sourceText?: string | null,
): Record<string, unknown> {
  return {
    schema: "plan",
    itemType: "ACTIVITY",
    subtype: "TASK",
    title: plan.placeName,
    status: planStatusToItemStatus(plan.status),
    planStatus: plan.status,
    plannedStartAt: plan.plannedStartAt,
    estimatedDurationMin: plan.experience?.estimatedDurationMin ?? null,
    bestTime: plan.experience?.bestTime ?? null,
    sourceText: sourceText ?? plan.sourceText ?? null,
    plan,
  };
}
