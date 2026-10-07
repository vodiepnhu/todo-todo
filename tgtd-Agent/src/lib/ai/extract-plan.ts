import { z } from "zod";
import { chatCompletionJson } from "./providers";
import { resolveLlmCallConfig } from "../../services/llm-settings-service";
import { extractGoogleMapsUrl } from "../maps/maps";
import {
  PlanSchema,
  emptyPlan,
  type Plan,
  type PlanDraft,
} from "../plans/plan-schema";
import { runMapsSearchAgent } from "../../agents/maps-search-agent";
import { detectLanguage, type Language } from "../../agents/language-agent";

const PLAN_SCHEMA_HINT = {
  placeName: "string",
  categories: ["string"],
  tags: ["string"],
  location: "string|null",
  googleMapsUrl: "string|null",
  googlePlaceId: "string|null",
  latitude: "number|null",
  longitude: "number|null",
  status: "PLANNING|VISITED|SKIPPED",
  travel: {
    from: "string|null",
    to: "string|null",
    transportMode: "string|null",
    estimatedDurationMin: "number|null",
    departureTime: "string|null",
    arrivalTime: "string|null",
    notes: "string|null",
  },
  experience: {
    estimatedDurationMin: "number|null",
    recommendedStartTime: "string|null",
    recommendedEndTime: "string|null",
    bestTime: "morning|afternoon|sunset|evening|anytime|null",
    flexibility: "flexible|fixed|approximate|null",
  },
  activities: ["string"],
  foodToTry: ["string"],
  preparations: ["string"],
  todos: [
    {
      task: "string",
      status: "pending|done|skipped",
      priority: "high|medium|low|null",
      note: "string|null",
    },
  ],
  costs: [
    {
      category: "string",
      estimatedAmount: "number",
      actualAmount: "number|null",
      currency: "string",
      note: "string|null",
    },
  ],
  notes: [
    {
      type: "general|tip|warning|personal|booking|accessibility|weather",
      content: "string",
    },
  ],
  plannedStartAt: "string|null",
  sourceText: "string|null",
} as const;

const SYSTEM = `You draft an Add-to-Plan form for a family planner.
Return ONLY valid JSON with { "plan": <complete plan>, "extracted": [], "suggestions": [], "missing": [] }.
Populate extracted with explicit facts from latest input, suggestions with generated values, and missing with uncertain or absent fields when applicable.
Input priority:
- Explicit facts from input take priority. Read the entire latest input and extract every explicit detail, including incidental clauses, parenthetical text, lists, and repeated mentions.
- Preserve exact user details for names, addresses or areas, dates, time windows, durations, budgets and currencies, travel origin/destination/mode, activities, food, preparations, constraints, preferences, companions, booking, accessibility, weather, and notes.
- Map every fact to the best field and keep multiple values. If no dedicated field fits, preserve the detail in notes or sourceText instead of dropping or summarizing it.
- Input may come from Chat or Continue with Planner. If it contains context plus a latest request, latest explicit request wins when they conflict.
- The extracted array contains only facts directly supported by input; include sourceText when possible. The suggestions array contains only generated ideas or soft estimates. Never present a suggestion as a fact.
- Generate safe suggestions for missing fields using place type and stated intent. Suggestions must be useful, concise, and editable in the form.
- Use null for missing scalar values and [] for missing arrays. Never output type labels such as "string|null" as values.
Soft-estimate rules (fill generously when place type is inferable):
- placeName: venue/destination name (required)
- categories: 1–3 place types (beach, cafe, hiking…)
- tags: 1–3 vibe tags (chill, date, nature…)
- activities: 2–5 things to do AT the destination
- preparations: 1–4 prep items BEFORE going
- experience: SUGGEST estimatedDurationMin + bestTime for the place type (beach→90–180 + sunset/morning; cafe→45–90 + morning/afternoon; museum→120; hike→180)
- notes: 0–2 typed notes (tip|warning|general) when useful; say if uncertain
- todos: optional 0–3 structured prep tasks
- status: "PLANNING"
Hard limits (never invent):
- googleMapsUrl: ONLY copy mapsUrl from payload / never fabricate
- costs: [] unless the user stated amounts
- travel: only if user hinted from/mode/duration; else null
- plannedStartAt: ISO only when user hints a day/time; use currentDate/timezone; else null
- Never invent Place IDs
Output field contract:
${JSON.stringify(PLAN_SCHEMA_HINT, null, 2)}`;

const MERGE_INSTRUCTION =
  "If basePlan is present, return a complete plan preserving fields not changed by the latest text. Latest explicit text wins.";

function normalizeModelPlan(modelPlan: Record<string, unknown>) {
  const nested = (
    key: string,
    defaults: Record<string, unknown>,
  ): unknown => {
    const value = modelPlan[key];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return value;
    }
    return { ...defaults, ...(value as Record<string, unknown>) };
  };

  const normalizeList = (
    key: "todos" | "costs" | "notes",
    defaults: Record<string, unknown>,
    aliases: Record<string, string[]> = {},
  ): unknown => {
    const value = modelPlan[key];
    if (!Array.isArray(value)) return value;
    return value.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return entry;
      }
      const object = entry as Record<string, unknown>;
      const normalized = { ...defaults, ...object };
      for (const [target, sources] of Object.entries(aliases)) {
        if (normalized[target] != null) continue;
        const source = sources.find(
          (key) => object[key] !== undefined && object[key] !== null,
        );
        if (source) normalized[target] = object[source];
      }
      return normalized;
    });
  };

  return {
    ...modelPlan,
    travel: nested("travel", {
      from: null,
      to: null,
      transportMode: null,
      estimatedDurationMin: null,
      departureTime: null,
      arrivalTime: null,
      notes: null,
    }),
    experience: nested("experience", {
      estimatedDurationMin: null,
      recommendedStartTime: null,
      recommendedEndTime: null,
      bestTime: null,
      flexibility: null,
    }),
    todos: normalizeList("todos", {
      status: "pending",
      priority: "medium",
      note: null,
    }, {
      task: ["title", "text", "name"],
    }),
    costs: normalizeList("costs", {
      actualAmount: null,
      currency: "AUD",
      note: null,
    }, {
      category: ["type", "name"],
      estimatedAmount: ["amount"],
    }),
    notes: normalizeList("notes", {}, {
      content: ["text", "note", "description"],
    }),
  } as Record<string, unknown>;
}

function parseModelJson(content: string): Record<string, unknown> {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  try {
    const value = JSON.parse(candidate);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const value = JSON.parse(candidate.slice(start, end + 1));
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
    }
  }
  throw new Error("LLM returned invalid JSON");
}

function mockExtract(text: string, maps?: string): PlanDraft {
  const cleaned = text.replace(/https?:\/\/\S+/g, "").trim();
  const place =
    cleaned.match(/(?:go to|visit|at)\s+([A-Z][\w\s']+)/i)?.[1]?.trim() ||
    cleaned.match(/Bondi(?:\s+Beach)?/i)?.[0] ||
    cleaned.split(/[.\n]/)[0]?.trim() ||
    "New place";
  const from = cleaned.match(/from\s+(\w+)/i)?.[1] ?? null;
  const mins = cleaned.match(/(\d+)\s*min/i);
  const hours = cleaned.match(/(\d+)\s*hours?/i);
  const draft = emptyPlan();
  draft.placeName = place;
  draft.status = "PLANNING";
  draft.googleMapsUrl = maps ?? null;
  draft.sourceText = text;

  const lower = `${place} ${cleaned}`.toLowerCase();
  const isBeach = /beach|bondi|manly|coogee/.test(lower);
  const isCafe = /cafe|brunch|coffee|bakery/.test(lower);
  const isMuseum = /museum|gallery/.test(lower);

  if (from || mins) {
    draft.travel = {
      from,
      to: place,
      transportMode: /car/i.test(text) ? "car" : null,
      estimatedDurationMin: mins ? Number(mins[1]) : null,
      departureTime: null,
      arrivalTime: null,
      notes: null,
    };
  }
  if (hours) {
    draft.experience = {
      estimatedDurationMin: Number(hours[1]) * 60,
      recommendedStartTime: null,
      recommendedEndTime: null,
      bestTime: /sunset/i.test(text) ? "sunset" : null,
      flexibility: null,
    };
  } else if (/sunset/i.test(text)) {
    draft.experience = {
      estimatedDurationMin: null,
      recommendedStartTime: null,
      recommendedEndTime: null,
      bestTime: "sunset",
      flexibility: null,
    };
  }
  const acts: string[] = [];
  if (/coastal walk|walk/i.test(text)) acts.push("Coastal walk");
  if (/photo/i.test(text)) acts.push("Take photos");
  draft.activities = acts;
  const prep: string[] = [];
  if (/sunscreen/i.test(text)) prep.push("Bring sunscreen");
  if (/weather/i.test(text)) prep.push("Check weather");
  draft.preparations = prep;
  const costs: PlanDraft["costs"] = [];
  const park = text.match(/parking[^\d]*\$?\s*(\d+)/i);
  if (park) {
    costs.push({
      category: "parking",
      estimatedAmount: Number(park[1]),
      actualAmount: null,
      currency: "AUD",
      note: null,
    });
  }
  const food = text.match(/(?:dinner|food)[^\d]*\$?\s*(\d+)/i);
  if (food) {
    costs.push({
      category: "food",
      estimatedAmount: Number(food[1]),
      actualAmount: null,
      currency: "AUD",
      note: null,
    });
  }
  draft.costs = costs;

  // Soft defaults when stated facts left gaps
  if (draft.categories.length === 0) {
    if (isBeach) draft.categories = ["beach", "outdoor"];
    else if (isCafe) draft.categories = ["cafe", "food"];
    else if (isMuseum) draft.categories = ["museum", "indoor"];
    else draft.categories = ["outing"];
  }
  if (draft.tags.length === 0) {
    if (isBeach) draft.tags = ["chill", "nature"];
    else if (isCafe) draft.tags = ["chill", "food"];
    else draft.tags = ["local"];
  }
  if (draft.activities.length === 0) {
    if (isBeach)
      draft.activities = ["Swim or paddle", "Coastal walk", "Take photos"];
    else if (isCafe)
      draft.activities = ["Order signature drinks", "Try a pastry"];
    else draft.activities = [`Explore ${place}`, "Take photos"];
  } else if (draft.activities.length < 2) {
    if (isBeach) draft.activities.push("Swim or paddle");
    else draft.activities.push(`Explore ${place}`);
  }
  if (draft.preparations.length === 0) {
    if (isBeach)
      draft.preparations = ["Check weather", "Bring sunscreen", "Pack towel"];
    else if (isCafe) draft.preparations = ["Check opening hours"];
    else draft.preparations = ["Check opening hours", "Plan transport"];
  }
  if (!draft.experience) {
    draft.experience = {
      estimatedDurationMin: isBeach ? 120 : isCafe ? 60 : isMuseum ? 120 : 90,
      recommendedStartTime: null,
      recommendedEndTime: null,
      bestTime: isBeach ? "sunset" : isCafe ? "morning" : "anytime",
      flexibility: "flexible",
    };
  } else {
    if (draft.experience.estimatedDurationMin == null) {
      draft.experience.estimatedDurationMin = isBeach
        ? 120
        : isCafe
          ? 60
          : 90;
    }
    if (draft.experience.bestTime == null) {
      draft.experience.bestTime = isBeach
        ? "sunset"
        : isCafe
          ? "morning"
          : "anytime";
    }
  }
  if (draft.notes.length === 0 && isBeach) {
    draft.notes = [
      {
        type: "tip",
        content: "Arrive early on weekends — parking fills up.",
      },
    ];
  }

  return draft;
}

export type FieldConfidence = {
  field: string;
  value: unknown;
  confidence: number;
  sourceText?: string | null;
};

export type PlanFieldSummary = {
  field: string;
  value: unknown;
  sourceText?: string | null;
  reason?: string | null;
};

export type PlanExtractionResult = {
  draft: PlanDraft;
  mocked: boolean;
  model: string;
  provider?: string;
  fallbackReason?:
    | "no_config"
    | "no_api_key"
    | "provider_error"
    | "invalid_response";
  fallbackDetail?: string;
  mapsDegraded: boolean;
  mapsNote?: string;
  mapsMetadataTrusted: boolean;
  confidence: FieldConfidence[];
  extracted: PlanFieldSummary[];
  suggestions: PlanFieldSummary[];
  missing: string[];
};

function normalizePlanPayload(raw: unknown): {
  plan: unknown;
  extracted: PlanFieldSummary[];
  suggestions: PlanFieldSummary[];
  missing: string[];
} {
  const envelope =
    raw && typeof raw === "object" && "plan" in raw
      ? (raw as {
          plan: unknown;
          extracted?: unknown;
          suggestions?: unknown;
          missing?: unknown;
        })
      : { plan: raw, extracted: [], suggestions: [], missing: [] };

  const summaries = (value: unknown): PlanFieldSummary[] =>
    Array.isArray(value)
      ? value
          .filter(
            (item): item is PlanFieldSummary =>
              !!item &&
              typeof item === "object" &&
              typeof (item as { field?: unknown }).field === "string",
          )
          .map((item) => ({
            field: item.field,
            value: item.value,
            ...(item.sourceText != null ? { sourceText: item.sourceText } : {}),
            ...(item.reason != null ? { reason: item.reason } : {}),
          }))
      : [];

  return {
    plan: envelope.plan,
    extracted: summaries(envelope.extracted),
    suggestions: summaries(envelope.suggestions),
    missing: Array.isArray(envelope.missing)
      ? envelope.missing.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function nonEmptyStrings(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
}

function mergeSuggestionsIntoPlan(
  draft: PlanDraft,
  suggestions: PlanFieldSummary[],
): PlanDraft {
  for (const suggestion of suggestions) {
    const field = suggestion.field.replace(/\s+/g, "");
    if (field === "categories" || field === "tags" || field === "activities" || field === "foodToTry" || field === "preparations") {
      const values = nonEmptyStrings(suggestion.value);
      if (!draft[field].length && values.length) draft[field] = values;
      continue;
    }

    if (field.startsWith("experience.")) {
      const key = field.slice("experience.".length) as keyof NonNullable<PlanDraft["experience"]>;
      const value = suggestion.value;
      if (value == null || value === "") continue;
      const experience = draft.experience ?? {
        estimatedDurationMin: null,
        recommendedStartTime: null,
        recommendedEndTime: null,
        bestTime: null,
        flexibility: null,
      };
      if (experience[key] != null && experience[key] !== "") continue;
      if (key === "estimatedDurationMin" && (!Number.isInteger(value) || Number(value) < 0)) continue;
      if (key === "bestTime" && !["morning", "afternoon", "sunset", "evening", "anytime"].includes(String(value))) continue;
      if (key === "flexibility" && !["flexible", "fixed", "approximate"].includes(String(value))) continue;
      if (!["estimatedDurationMin", "recommendedStartTime", "recommendedEndTime", "bestTime", "flexibility"].includes(key)) continue;
      (experience as Record<string, unknown>)[key] = value;
      draft.experience = experience;
      continue;
    }

    if (field === "todos" || field === "costs" || field === "notes") {
      if (draft[field].length || !Array.isArray(suggestion.value)) continue;
      const parsed = PlanSchema.safeParse({ ...draft, [field]: suggestion.value });
      if (!parsed.success) continue;
      if (field === "todos") draft.todos = parsed.data.todos;
      if (field === "costs") draft.costs = parsed.data.costs;
      if (field === "notes") draft.notes = parsed.data.notes;
    }
  }
  return draft;
}

export async function extractPlanFromChat(input: {
  userId: string;
  text: string;
  currentRequest?: string;
  timezone?: string;
  lookupMaps?: boolean;
  basePlan?: PlanDraft;
  language?: Language;
}): Promise<PlanExtractionResult> {
  const language = input.language ?? detectLanguage(input.text);
  const maps = extractGoogleMapsUrl(input.currentRequest ?? input.text) ?? undefined;
  const config = await resolveLlmCallConfig(input.userId);
  const now = new Date();

  let draft: PlanDraft;
  let mocked = false;
  let model = "mock-extract";
  let extracted: PlanFieldSummary[] = [];
  let suggestions: PlanFieldSummary[] = [];
  let fallbackReason:
    | "no_config"
    | "no_api_key"
    | "provider_error"
    | "invalid_response"
    | undefined;
  let fallbackDetail: string | undefined;
  let mapsDegraded = false;
  let mapsNote: string | undefined;

  const canCall =
    config &&
    (config.apiKey ||
      config.provider === "ollama" ||
      config.provider === "custom");

  if (!canCall || !config) {
    draft = mockExtract(input.text, maps);
    mocked = true;
    fallbackReason = config ? "no_api_key" : "no_config";
  } else {
    try {
      const { content, model: m } = await chatCompletionJson(config, [
        {
          role: "system",
          content: input.basePlan
            ? `${SYSTEM}\n${MERGE_INSTRUCTION}\nWrite generated text in ${language === "vi" ? "Vietnamese" : "English"}.`
            : `${SYSTEM}\nWrite generated text in ${language === "vi" ? "Vietnamese" : "English"}.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            text: input.text,
            basePlan: input.basePlan,
            mapsUrl: maps ?? null,
            currentDate: now.toISOString().slice(0, 10),
            timezone: input.timezone ?? "Australia/Sydney",
            schemaHint: PLAN_SCHEMA_HINT,
            responseLanguage: language,
          }),
        },
      ]);
      const normalized = normalizePlanPayload(parseModelJson(content));
      extracted = normalized.extracted;
      suggestions = normalized.suggestions;
      const rawPlan =
        normalized.plan &&
        typeof normalized.plan === "object" &&
        !Array.isArray(normalized.plan)
          ? (normalized.plan as Record<string, unknown>)
          : {};
      const base = input.basePlan;
      const mergedPlan = base && normalized.plan && typeof normalized.plan === "object" && !Array.isArray(normalized.plan)
        ? {
            ...base,
            ...rawPlan,
            travel: rawPlan.travel && typeof rawPlan.travel === "object" && !Array.isArray(rawPlan.travel) && base.travel
              ? { ...base.travel, ...rawPlan.travel as Record<string, unknown> }
              : rawPlan.travel === undefined ? base.travel : rawPlan.travel,
            experience: rawPlan.experience && typeof rawPlan.experience === "object" && !Array.isArray(rawPlan.experience) && base.experience
              ? { ...base.experience, ...rawPlan.experience as Record<string, unknown> }
              : rawPlan.experience === undefined ? base.experience : rawPlan.experience,
          }
        : rawPlan;
      const modelPlan = normalizeModelPlan(mergedPlan);
      const parsed = PlanSchema.safeParse({
        ...emptyPlan(),
        ...modelPlan,
        placeName:
          modelPlan.placeName ||
          modelPlan.togo ||
          modelPlan.place_name ||
          "",
      });
      draft = parsed.success && normalized.plan && typeof normalized.plan === "object" && !Array.isArray(normalized.plan)
        ? parsed.data
        : mockExtract(input.text, maps);
      mocked = !parsed.success || !normalized.plan || typeof normalized.plan !== "object" || Array.isArray(normalized.plan);
      if (mocked) {
        fallbackReason = "invalid_response";
        fallbackDetail = parsed.success ? "plan: expected object" : parsed.error.issues
          .slice(0, 2)
          .map((issue) => {
            const path = issue.path.length ? issue.path.join(".") : "plan";
            return `${path}: ${issue.message}`;
          })
          .join("; ");
        extracted = [];
        suggestions = [];
      }
      if (!mocked) draft = mergeSuggestionsIntoPlan(draft, suggestions);
      model = m;
    } catch (error) {
      draft = mockExtract(input.text, maps);
      mocked = true;
      fallbackReason = "provider_error";
      fallbackDetail =
        error instanceof Error && error.message.length <= 120
          ? error.message
          : "provider request failed";
      model = "mock-extract-fallback";
    }
  }

  const samePlace = input.basePlan && draft.placeName.trim().toLowerCase() === input.basePlan.placeName.trim().toLowerCase();
  const keepBaseMetadata = samePlace && (!maps || maps === input.basePlan?.googleMapsUrl);
  let mapsMetadataTrusted = Boolean(
    maps || (samePlace && input.basePlan?.googleMapsUrl),
  );
  draft.googleMapsUrl = maps ?? (samePlace ? input.basePlan!.googleMapsUrl : null);
  draft.googlePlaceId = keepBaseMetadata ? input.basePlan!.googlePlaceId : null;
  draft.latitude = keepBaseMetadata ? input.basePlan!.latitude : null;
  draft.longitude = keepBaseMetadata ? input.basePlan!.longitude : null;
  draft.location = keepBaseMetadata ? input.basePlan!.location : null;
  draft.sourceText = input.text;

  if (input.lookupMaps !== false && draft.placeName && !draft.googleMapsUrl) {
    const lookup = await runMapsSearchAgent({ query: draft.placeName });
    mapsDegraded = lookup.degraded;
    mapsNote = lookup.note;
    if (lookup.topMapsUrl) {
      draft.googleMapsUrl = lookup.topMapsUrl;
      const hit = lookup.hits[0];
      if (hit) {
        mapsMetadataTrusted = true;
        draft.googlePlaceId = hit.googlePlaceId;
        draft.latitude = hit.latitude;
        draft.longitude = hit.longitude;
        if (!draft.location && hit.formattedAddress) {
          draft.location = hit.formattedAddress;
        }
      }
    }
  }

  const missing: string[] = [];
  if (!draft.googleMapsUrl) missing.push("Google Maps link");
  if (!draft.plannedStartAt) missing.push("Exact date");
  if (!draft.travel?.estimatedDurationMin) missing.push("Travel time");

  const confidence: FieldConfidence[] = [
    {
      field: "placeName",
      value: draft.placeName,
      confidence: draft.placeName ? 0.9 : 0,
    },
    {
      field: "travel.estimatedDurationMin",
      value: draft.travel?.estimatedDurationMin ?? null,
      confidence: draft.travel?.estimatedDurationMin != null ? 0.85 : 0,
    },
    {
      field: "googleMapsUrl",
      value: draft.googleMapsUrl,
      confidence: draft.googleMapsUrl ? 0.8 : 0,
    },
  ];

  return {
    draft,
    mocked,
    model,
    provider: config?.provider,
    fallbackReason,
    fallbackDetail,
    mapsDegraded,
    mapsNote,
    confidence,
    extracted,
    suggestions,
    missing,
    mapsMetadataTrusted,
  };
}

export const ExtractBodySchema = z.object({
  workspaceId: z.string().uuid(),
  text: z.string().min(1).max(4000),
  timezone: z.string().max(80).optional(),
  lookupMaps: z.boolean().optional(),
});

export type { Plan };
