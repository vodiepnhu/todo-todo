import { z } from "zod";

export const PlannerIntentSchema = z.enum([
  "CREATE_ITEM",
  "UPDATE_ITEM",
  "DELETE_ITEM",
  "LOG_EVENT",
  "LIST_ITEMS",
  "GET_ITEM",
  "LIST_HISTORY",
  "RECOMMEND_TASK",
  "RECOMMEND_PLACE",
  "RECOMMEND_BOTH",
  "HELP",
  "UNKNOWN",
]);

export const PlannerItemSchema = z.object({
  itemType: z.preprocess(
    (val) => {
      if (val === "TODO" || val === "TOGO" || val === "ACTIVITY") {
        return "ACTIVITY";
      }
      return val;
    },
    z.literal("ACTIVITY").optional(),
  ),
  subtype: z.preprocess(
    (val) => {
      if (val == null || val === "") return undefined;
      return "TASK";
    },
    z.literal("TASK").optional(),
  ),
  title: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.number().optional(),
  repeatMode: z.enum(["ONE_OFF", "REPEATABLE", "RECURRING"]).optional(),
  dueAt: z.string().nullable().optional(),
  plannedStartAt: z.string().nullable().optional(),
  timePrecision: z
    .enum(["EXACT", "DATE_ONLY", "APPROXIMATE", "UNKNOWN"])
    .optional(),
  estimatedDurationMin: z.number().nullable().optional(),
  durationSource: z.string().optional(),
  placeQuery: z.string().optional(),
  googleMapsUrl: z.string().optional(),
  id: z.string().optional(),
});

export const PlannerRequestSchema = z.object({
  intent: PlannerIntentSchema,
  confidence: z.number().min(0).max(1).default(0.5),
  targetReference: z.string().nullable().optional(),
  items: z.array(PlannerItemSchema).default([]),
  event: z
    .object({
      eventType: z
        .enum([
          "COMPLETED",
          "VISITED",
          "TRIED",
          "STARTED",
          "SKIPPED",
          "CANCELLED",
        ])
        .optional(),
      occurredAt: z.string().optional(),
      note: z.string().optional(),
    })
    .optional(),
  recommendationQuery: z.string().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  ambiguities: z.array(z.string()).default([]),
  reply: z.string().optional(),
});

export type PlannerRequest = z.infer<typeof PlannerRequestSchema>;
