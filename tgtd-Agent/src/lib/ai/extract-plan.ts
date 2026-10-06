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

const SYSTEM = `You draft an Add-to-Plan form for a family planner.
Return ONLY valid JSON matching the plan schema.
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
- Never invent Place IDs`;

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

export async function extractPlanFromChat(input: {
  userId: string;
  text: string;
  timezone?: string;
  lookupMaps?: boolean;
}): Promise<{
  draft: PlanDraft;
  mocked: boolean;
  model: string;
  confidence: FieldConfidence[];
  missing: string[];
}> {
  const maps = extractGoogleMapsUrl(input.text) ?? undefined;
  const config = await resolveLlmCallConfig(input.userId);
  const now = new Date();

  let draft: PlanDraft;
  let mocked = false;
  let model = "mock-extract";

  const canCall =
    config &&
    (config.apiKey ||
      config.provider === "ollama" ||
      config.provider === "custom");

  if (!canCall || !config) {
    draft = mockExtract(input.text, maps);
    mocked = true;
  } else {
    try {
      const { content, model: m } = await chatCompletionJson(config, [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: JSON.stringify({
            text: input.text,
            mapsUrl: maps ?? null,
            currentDate: now.toISOString().slice(0, 10),
            timezone: input.timezone ?? "Australia/Sydney",
            schemaHint: {
              placeName: "string",
              categories: [],
              tags: [],
              location: null,
              googleMapsUrl: null,
              status: "PLANNING",
              travel: null,
              experience: null,
              activities: [],
              preparations: [],
              todos: [],
              costs: [],
              notes: [],
              plannedStartAt: null,
            },
          }),
        },
      ]);
      const parsed = PlanSchema.safeParse({
        ...emptyPlan(),
        ...JSON.parse(content),
        placeName:
          JSON.parse(content).placeName ||
          JSON.parse(content).togo ||
          JSON.parse(content).place_name ||
          "",
      });
      draft = parsed.success
        ? parsed.data
        : mockExtract(input.text, maps);
      mocked = !parsed.success;
      model = m;
    } catch {
      draft = mockExtract(input.text, maps);
      mocked = true;
      model = "mock-extract-fallback";
    }
  }

  if (maps && !draft.googleMapsUrl) draft.googleMapsUrl = maps;
  draft.sourceText = input.text;

  if (input.lookupMaps !== false && draft.placeName && !draft.googleMapsUrl) {
    const lookup = await runMapsSearchAgent({ query: draft.placeName });
    if (lookup.topMapsUrl) {
      draft.googleMapsUrl = lookup.topMapsUrl;
      const hit = lookup.hits[0];
      if (hit) {
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

  return { draft, mocked, model, confidence, missing };
}

export const ExtractBodySchema = z.object({
  workspaceId: z.string().uuid(),
  text: z.string().min(1).max(4000),
  timezone: z.string().max(80).optional(),
  lookupMaps: z.boolean().optional(),
});

export type { Plan };
