import { z } from "zod";

/** Pure draft helpers — safe for client components (no providers / admin). */

export const EnrichBestTimeSchema = z.enum([
  "morning",
  "afternoon",
  "sunset",
  "evening",
  "anytime",
]);

export const EnrichItemDraftSchema = z.object({
  title: z.string().min(1),
  placeQuery: z.string().nullable().optional(),
  googleMapsUrl: z.string().nullable().optional(),
  activities: z.string().nullable().optional(),
  foodToTry: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  plannedStartAt: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
  estimatedDurationMin: z.number().nullable().optional(),
  bestTime: EnrichBestTimeSchema.nullable().optional(),
  timePrecision: z
    .enum(["EXACT", "DATE_ONLY", "APPROXIMATE", "UNKNOWN"])
    .optional(),
});

export type EnrichItemDraft = z.infer<typeof EnrichItemDraftSchema>;

export function composeDescription(draft: EnrichItemDraft): string {
  const parts: string[] = [];
  if (draft.activities?.trim())
    parts.push(`Activities:\n${draft.activities.trim()}`);
  if (draft.foodToTry?.trim())
    parts.push(`Food to try:\n${draft.foodToTry.trim()}`);
  if (draft.notes?.trim()) parts.push(`Notes:\n${draft.notes.trim()}`);
  return parts.join("\n\n") || "";
}

/** Best-effort reverse of composeDescription for edit prefill. */
export function parseDescriptionToDraft(
  description: string | null | undefined,
): Pick<EnrichItemDraft, "activities" | "foodToTry" | "notes"> {
  const raw = description?.trim() ?? "";
  if (!raw) return { activities: null, foodToTry: null, notes: null };

  const sections: Record<string, string> = {};
  const re = /^(Activities|Food to try|Notes):\s*\n?/gim;
  const parts = raw.split(re);
  for (let i = 1; i < parts.length; i += 2) {
    const label = parts[i]?.trim().toLowerCase();
    const body = parts[i + 1]?.trim() ?? "";
    if (!label) continue;
    sections[label] = body;
  }

  if (Object.keys(sections).length === 0) {
    return { activities: null, foodToTry: null, notes: raw };
  }

  return {
    activities: sections["activities"] || null,
    foodToTry: sections["food to try"] || null,
    notes: sections["notes"] || null,
  };
}

export function draftToCreatePayload(
  draft: EnrichItemDraft,
  sourceText: string,
): Record<string, unknown> {
  return {
    itemType: "ACTIVITY",
    subtype: "TASK",
    title: draft.title.trim(),
    description: composeDescription(draft) || null,
    placeQuery: draft.placeQuery?.trim() || undefined,
    googleMapsUrl: draft.googleMapsUrl?.trim() || undefined,
    plannedStartAt: draft.plannedStartAt || null,
    dueAt: draft.dueAt || null,
    estimatedDurationMin: draft.estimatedDurationMin ?? null,
    bestTime: draft.bestTime ?? null,
    timePrecision: draft.timePrecision ?? "UNKNOWN",
    durationSource: draft.estimatedDurationMin != null ? "llm_estimate" : null,
    sourceText,
  };
}
