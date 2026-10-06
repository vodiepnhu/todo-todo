import { getEnv } from "../env";
import { PlannerRequestSchema, type PlannerRequest } from "../../schemas/planner";
import { chatCompletionJson } from "./providers";
import { resolveLlmCallConfig } from "../../services/llm-settings-service";

const SYSTEM_PROMPT = `You are Planner, an AI assistant for a shared family/couple planning app.
Return ONLY valid JSON matching this shape:
{
  "intent": "CREATE_ITEM|UPDATE_ITEM|DELETE_ITEM|LOG_EVENT|LIST_ITEMS|GET_ITEM|LIST_HISTORY|RECOMMEND_TASK|RECOMMEND_PLACE|RECOMMEND_BOTH|HELP|UNKNOWN",
  "confidence": 0-1,
  "targetReference": string|null,
  "items": [{ "itemType":"ACTIVITY", "subtype":"TASK", "title": string, "plannedStartAt": string|null, "dueAt": string|null, "timePrecision":"EXACT|DATE_ONLY|APPROXIMATE|UNKNOWN", "placeQuery": string, "googleMapsUrl": string, "estimatedDurationMin": number|null, "repeatMode":"ONE_OFF|REPEATABLE|RECURRING", "id": string }],
  "event": { "eventType":"COMPLETED|STARTED|SKIPPED|CANCELLED", "occurredAt": string, "note": string },
  "recommendationQuery": string,
  "ambiguities": string[],
  "reply": string
}
Never invent Google Place IDs. Prefer DATE_ONLY when user only mentions a day name.
Use the provided currentDate/currentDatetime/timezone — do not invent today's date.
If recentChat is provided, use it only for disambiguation (names, places, prior intent). Ignore soft-deleted history (it will not appear). Prefer the current message over older chat when they conflict.`;

function mockParse(
  message: string,
  currentDate: string,
  recentChat?: string,
): PlannerRequest {
  const lower = message.toLowerCase();
  const context = [recentChat, message].filter(Boolean).join("\n");
  if (lower.includes("what should") || lower.includes("recommend")) {
    return PlannerRequestSchema.parse({
      intent: "RECOMMEND_TASK",
      confidence: 0.7,
      recommendationQuery: message,
      reply: "Here are a few options from your lists.",
      items: [],
      ambiguities: [],
    });
  }
  if (
    lower.includes("visited") ||
    lower.includes("went to") ||
    lower.includes("completed")
  ) {
    const titleMatch = message.match(
      /(?:visited|went to|completed)\s+(.+?)(?:\s+yesterday|\s+today|\s+at\s|$)/i,
    );
    return PlannerRequestSchema.parse({
      intent: "LOG_EVENT",
      confidence: 0.75,
      items: [
        {
          title: titleMatch?.[1]?.trim() || "Activity",
          itemType: "ACTIVITY",
          subtype: "TASK",
        },
      ],
      event: {
        eventType: "COMPLETED",
        occurredAt: currentDate,
      },
      reply: "I prepared an event draft. Nothing has been saved yet.",
      ambiguities: [],
    });
  }
  if (
    lower.includes("move ") ||
    lower.includes("change ") ||
    lower.includes("update ")
  ) {
    return PlannerRequestSchema.parse({
      intent: "UPDATE_ITEM",
      confidence: 0.7,
      targetReference: message,
      items: [
        { title: "Updated item", plannedStartAt: null, timePrecision: "DATE_ONLY" },
      ],
      reply: "I prepared an update draft. Nothing has been saved yet.",
      ambiguities: [],
    });
  }
  const place =
    context.match(
      /(?:visit|go to|at|add)\s+(.+?)(?=\s+(?:this|next|on|for|and|to|maybe|do|take|remind)\b|[,.!?\n]|$)/i,
    )?.[1]?.trim() ||
    context.match(/\b(Bondi(?:\s+Beach)?|IKEA\s+Tempe|Manly Beach|Coogee Beach)\b/i)?.[1] ||
    "New item";
  const isPlace = /beach|ikea|cafe|restaurant|park|mall|gym/i.test(place);
  return PlannerRequestSchema.parse({
    intent: "CREATE_ITEM",
    confidence: 0.8,
    items: [
      {
        itemType: "ACTIVITY",
        subtype: "TASK",
        title: place.trim(),
        timePrecision:
          /saturday|sunday|monday|tuesday|wednesday|thursday|friday|today|tomorrow/i.test(
            message,
          )
            ? "DATE_ONLY"
            : "UNKNOWN",
        plannedStartAt: null,
      placeQuery: isPlace || place !== "New item" ? place.trim() : undefined,
      },
    ],
    reply: `I've prepared an activity draft. Nothing has been saved yet.`,
    ambiguities: [],
  });
}

export async function parsePlannerMessage(input: {
  message: string;
  currentDate: string;
  currentDatetime: string;
  workspaceTimezone: string;
  userId: string;
  recentChat?: string;
}): Promise<{
  request: PlannerRequest;
  model: string;
  mocked: boolean;
  latencyMs: number;
  provider?: string;
}> {
  const started = Date.now();
  const config = await resolveLlmCallConfig(input.userId);

  if (!config) {
    const request = mockParse(input.message, input.currentDate, input.recentChat);
    return {
      request,
      model: "mock",
      mocked: true,
      latencyMs: Date.now() - started,
    };
  }

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: JSON.stringify({
        message: input.message,
        currentDate: input.currentDate,
        currentDatetime: input.currentDatetime,
        workspaceTimezone: input.workspaceTimezone,
        recentChat: input.recentChat || null,
      }),
    },
  ];

  try {
    const { content, model } = await chatCompletionJson(config, messages);
    const parsed = PlannerRequestSchema.safeParse(JSON.parse(content));
    if (!parsed.success) throw new Error("Zod validation failed");
    return {
      request: parsed.data,
      model,
      mocked: false,
      latencyMs: Date.now() - started,
      provider: config.provider,
    };
  } catch {
    // Fallback: env OpenRouter fallback model if using openrouter
    const env = getEnv();
    if (config.provider === "openrouter" && env.OPENROUTER_FALLBACK_MODEL) {
      try {
        const { content, model } = await chatCompletionJson(
          { ...config, model: env.OPENROUTER_FALLBACK_MODEL },
          messages,
        );
        const parsed = PlannerRequestSchema.safeParse(JSON.parse(content));
        if (!parsed.success) throw new Error("Zod validation failed");
        return {
          request: parsed.data,
          model,
          mocked: false,
          latencyMs: Date.now() - started,
          provider: config.provider,
        };
      } catch {
        /* fall through */
      }
    }
    const request = mockParse(input.message, input.currentDate, input.recentChat);
    return {
      request,
      model: "mock-fallback",
      mocked: true,
      latencyMs: Date.now() - started,
      provider: config.provider,
    };
  }
}
