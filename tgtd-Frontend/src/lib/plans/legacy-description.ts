import { parseDescriptionToDraft } from "@/lib/ai/enrich-item-draft";
import type { PlanDraft } from "@/lib/plans/plan-schema";

function linesToList(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Seed activities/food from legacy description sections when children are empty. */
export function seedPlanFromDescription(
  draft: PlanDraft,
  description: string | null | undefined,
): PlanDraft {
  const parsed = parseDescriptionToDraft(description);
  let activities = draft.activities;
  let foodToTry = draft.foodToTry;
  if (activities.length === 0) {
    const fromDesc = linesToList(parsed.activities);
    if (fromDesc.length) activities = fromDesc;
  }
  if (foodToTry.length === 0) {
    const fromDesc = linesToList(parsed.foodToTry);
    if (fromDesc.length) foodToTry = fromDesc;
  }
  if (activities === draft.activities && foodToTry === draft.foodToTry) {
    return draft;
  }
  return { ...draft, activities, foodToTry };
}
