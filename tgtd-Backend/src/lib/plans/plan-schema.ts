/**
 * Canonical Add-to-Plan contract (form + LLM extract).
 * DB mapping:
 * - placeName, location, googleMapsUrl, categories, tags → places (+ item_places PRIMARY)
 * - status → items.plan_status (+ items.status via planStatusToItemStatus)
 * - experience → items.estimated_duration_min / best_time
 * - plannedStartAt → items.planned_start_at
 * - travel → plan_travel
 * - costs → plan_costs
 * - activities → plan_activities
 * - preparations → plan_preparations
 * - todos → plan_todos
 * - notes → plan_notes
 * - sourceText → items.source_text
 * - items.title = placeName
 */
import { z } from "zod";

export const PlanStatusSchema = z.enum([
  "PLANNING",
  "VISITED",
  "SKIPPED",
]);
export type PlanStatus = z.infer<typeof PlanStatusSchema>;

export const BestTimeSchema = z.enum([
  "morning",
  "afternoon",
  "sunset",
  "evening",
  "anytime",
]);
export type BestTime = z.infer<typeof BestTimeSchema>;

export const PlanNoteTypeSchema = z.enum([
  "general",
  "tip",
  "warning",
  "personal",
  "booking",
  "accessibility",
  "weather",
]);
export type PlanNoteType = z.infer<typeof PlanNoteTypeSchema>;

export const PlanTodoStatusSchema = z.enum([
  "pending",
  "done",
  "skipped",
]);
export type PlanTodoStatus = z.infer<typeof PlanTodoStatusSchema>;

export const PlanTodoPrioritySchema = z.enum(["high", "medium", "low"]);
export type PlanTodoPriority = z.infer<typeof PlanTodoPrioritySchema>;

export const PlanTravelSchema = z.object({
  from: z.string().nullable(),
  to: z.string().nullable(),
  transportMode: z.string().nullable(),
  estimatedDurationMin: z.number().int().nonnegative().nullable(),
  departureTime: z.string().nullable(),
  arrivalTime: z.string().nullable(),
  notes: z.string().nullable(),
});

export const PlanExperienceSchema = z.object({
  estimatedDurationMin: z.number().int().nonnegative().nullable(),
  recommendedStartTime: z.string().nullable().optional().transform((v) => v ?? null),
  recommendedEndTime: z.string().nullable().optional().transform((v) => v ?? null),
  bestTime: BestTimeSchema.nullable(),
  flexibility: z
    .enum(["flexible", "fixed", "approximate"])
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});

export const PlanCostSchema = z.object({
  category: z.string().min(1),
  estimatedAmount: z.number().nonnegative(),
  actualAmount: z.number().nonnegative().nullable(),
  currency: z.string().min(1).default("AUD"),
  note: z.string().nullable(),
});

export const PlanTodoSchema = z.object({
  task: z.string().min(1),
  status: PlanTodoStatusSchema.default("pending"),
  priority: PlanTodoPrioritySchema.nullable().default("medium"),
  note: z.string().nullable(),
});

export const PlanNoteSchema = z.object({
  type: PlanNoteTypeSchema,
  content: z.string().min(1),
});

const nullableString = z
  .string()
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const planFields = {
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  location: nullableString,
  googleMapsUrl: nullableString,
  status: PlanStatusSchema.default("PLANNING"),
  travel: PlanTravelSchema.nullable()
    .optional()
    .transform((v) => v ?? null),
  experience: PlanExperienceSchema.nullable()
    .optional()
    .transform((v) => v ?? null),
  activities: z.array(z.string()).default([]),
  foodToTry: z.array(z.string()).default([]),
  preparations: z.array(z.string()).default([]),
  todos: z.array(PlanTodoSchema).default([]),
  costs: z.array(PlanCostSchema).default([]),
  notes: z.array(PlanNoteSchema).default([]),
  plannedStartAt: nullableString,
  sourceText: nullableString,
};

export const PlanDraftSchema = z.object({
  placeName: z.string(),
  ...planFields,
});

export const PlanSchema = z.object({
  placeName: z.string().trim().min(1),
  ...planFields,
});

export type PlanDraft = z.infer<typeof PlanDraftSchema>;
export type Plan = z.infer<typeof PlanSchema>;

export function emptyPlan(): PlanDraft {
  return {
    placeName: "",
    categories: [],
    tags: [],
    location: null,
    googleMapsUrl: null,
    status: "PLANNING",
    travel: null,
    experience: null,
    activities: [],
    foodToTry: [],
    preparations: [],
    todos: [],
    costs: [],
    notes: [],
    plannedStartAt: null,
    sourceText: null,
  };
}

export function estimatedCostTotal(plan: Pick<PlanDraft, "costs">): number {
  return plan.costs.reduce((sum, c) => sum + (c.estimatedAmount || 0), 0);
}

export function actualCostTotal(plan: Pick<PlanDraft, "costs">): number {
  return plan.costs.reduce((sum, c) => sum + (c.actualAmount || 0), 0);
}

export function planStatusToItemStatus(
  status: PlanStatus,
): "ACTIVE" | "COMPLETED" | "ARCHIVED" {
  if (status === "VISITED") return "COMPLETED";
  if (status === "SKIPPED") return "ARCHIVED";
  return "ACTIVE";
}
