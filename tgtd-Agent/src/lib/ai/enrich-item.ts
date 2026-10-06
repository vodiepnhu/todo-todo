import { chatCompletionJson } from "./providers";
import {
  EnrichItemDraftSchema,
  type EnrichItemDraft,
} from "./enrich-item-draft";
import {
  extractGoogleMapsUrl,
  safeMapsRedirect,
  searchPlace,
} from "../maps/maps";
import { resolvePlace, type PlaceCandidate } from "../../agents/places-agent";
import { resolveLlmCallConfig } from "../../services/llm-settings-service";

export {
  EnrichItemDraftSchema,
  composeDescription,
  draftToCreatePayload,
  parseDescriptionToDraft,
  type EnrichItemDraft,
} from "./enrich-item-draft";

const SYSTEM = `You enrich a quick-add draft for a shared family planner (activities).
Return ONLY valid JSON:
{
  "title": string,
  "placeQuery": string|null,
  "googleMapsUrl": string|null,
  "activities": string|null,
  "foodToTry": string|null,
  "notes": string|null,
  "plannedStartAt": string|null,
  "dueAt": string|null,
  "estimatedDurationMin": number|null,
  "bestTime": "morning"|"afternoon"|"sunset"|"evening"|"anytime"|null,
  "timePrecision": "EXACT"|"DATE_ONLY"|"APPROXIMATE"|"UNKNOWN"
}
Rules:
- Keep title short and concrete.
- placeQuery: venue / area name if relevant; else null.
- googleMapsUrl: ONLY copy mapsUrl from the user payload when present. NEVER invent Maps URLs or Place IDs.
- activities: things to do / task breakdown (short bullets or commas).
- foodToTry: dishes / cafes worth noting when food-related; else null.
- notes: tips, caveats, packing, booking — brief; may use general knowledge; say if uncertain.
- estimatedDurationMin: SUGGEST a typical experience length in minutes for place/activity visits (e.g. beach 90–180, cafe 45–90, museum 120). Prefer a number over null when placeQuery is set.
- bestTime: SUGGEST morning|afternoon|sunset|evening|anytime for the place type (beach→sunset/morning, cafe→morning/afternoon, nightlife→evening). null only if no place.
- plannedStartAt / dueAt: ISO-8601 ONLY when the user hints a day/time ("Sunday", "this weekend", "tomorrow 3pm"). Use currentDate/timezone. Else null.
- Prefer DATE_ONLY when only a day is mentioned; EXACT when a clock time is given.`;

export type EnrichSearchPlace = (
  query: string,
) => Promise<{ degraded: boolean; results: PlaceCandidate[] }>;

export type EnrichItemDeps = {
  searchPlace?: EnrichSearchPlace;
};

function mockEnrich(
  text: string,
  maps: string | undefined,
): EnrichItemDraft {
  const cleaned = text.replace(/https?:\/\/\S+/g, "").trim() || "New item";
  const title =
    cleaned.match(/add\s+(.+)/i)?.[1]?.trim() ||
    cleaned.split(/[.\n]/)[0]?.trim() ||
    cleaned;
  const isPlace = /beach|ikea|cafe|restaurant|park|mall|gym|market|temple|zoo|haymarket|chinatown/i.test(
    title,
  );
  const dayHint =
    cleaned.match(
      /\b(today|tomorrow|this\s+weekend|sunday|saturday|monday|tuesday|wednesday|thursday|friday)\b/i,
    )?.[0] ?? null;
  let plannedStartAt: string | null = null;
  let timePrecision: EnrichItemDraft["timePrecision"] = "UNKNOWN";
  if (dayHint) {
    const now = new Date();
    if (/tomorrow/i.test(dayHint)) now.setDate(now.getDate() + 1);
    plannedStartAt = now.toISOString().slice(0, 10);
    timePrecision = "DATE_ONLY";
  }
  return EnrichItemDraftSchema.parse({
    title,
    placeQuery: isPlace ? title : null,
    googleMapsUrl: maps ?? null,
    activities: isPlace
      ? `Visit ${title}, explore main areas`
      : `Complete: ${title}`,
    foodToTry: /cafe|restaurant|food|eat|lunar|chinatown|haymarket/i.test(title)
      ? "Ask staff for popular items"
      : null,
    notes: maps
      ? "Maps link attached — open for directions."
      : isPlace
        ? "Check opening hours before you go."
        : null,
    plannedStartAt,
    dueAt: plannedStartAt,
    estimatedDurationMin: isPlace ? 90 : 30,
    bestTime: isPlace
      ? /beach|sunset/i.test(title)
        ? "sunset"
        : /cafe|morning/i.test(title)
          ? "morning"
          : "anytime"
      : null,
    timePrecision,
  });
}

async function applyMapsResolution(
  draft: EnrichItemDraft,
  text: string,
  deps?: EnrichItemDeps,
): Promise<{ draft: EnrichItemDraft; mapsDegraded: boolean }> {
  const resolved = await resolvePlace({
    message: text,
    placeQuery: draft.placeQuery ?? undefined,
    googleMapsUrl: draft.googleMapsUrl ?? undefined,
    extractMapsUrl: (t) => extractGoogleMapsUrl(t) ?? undefined,
    safeMapsUrl: safeMapsRedirect,
    searchPlace:
      deps?.searchPlace ??
      (async (query) => {
        const res = await searchPlace(query);
        return {
          degraded: res.degraded,
          results: res.results as PlaceCandidate[],
        };
      }),
  });

  const next = { ...draft };
  if (resolved.googleMapsUrl) {
    next.googleMapsUrl = resolved.googleMapsUrl;
  }
  if (resolved.name) {
    next.placeQuery = resolved.name;
  } else if (resolved.placeQuery && !next.placeQuery) {
    next.placeQuery = resolved.placeQuery;
  }
  return { draft: next, mapsDegraded: resolved.degraded };
}

export async function enrichItemDraft(input: {
  userId: string;
  text: string;
  timezone?: string;
  deps?: EnrichItemDeps;
}): Promise<{
  draft: EnrichItemDraft;
  mocked: boolean;
  model: string;
  mapsDegraded: boolean;
}> {
  const maps = extractGoogleMapsUrl(input.text) ?? undefined;
  const config = await resolveLlmCallConfig(input.userId);
  const now = new Date();
  const currentDate = now.toISOString().slice(0, 10);
  const currentDatetime = now.toISOString();

  const finish = async (
    draft: EnrichItemDraft,
    meta: { mocked: boolean; model: string },
  ) => {
    const { draft: resolved, mapsDegraded } = await applyMapsResolution(
      draft,
      input.text,
      input.deps,
    );
    return { ...meta, draft: resolved, mapsDegraded };
  };

  if (
    !config?.apiKey &&
    config?.provider !== "ollama" &&
    config?.provider !== "custom"
  ) {
    return finish(mockEnrich(input.text, maps), {
      mocked: true,
      model: "mock-enrich",
    });
  }
  if (!config) {
    return finish(mockEnrich(input.text, maps), {
      mocked: true,
      model: "mock-enrich",
    });
  }

  try {
    const { content, model } = await chatCompletionJson(config, [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: JSON.stringify({
          text: input.text,
          mapsUrl: maps ?? null,
          currentDate,
          currentDatetime,
          timezone: input.timezone ?? "Australia/Sydney",
        }),
      },
    ]);
    const parsed = EnrichItemDraftSchema.parse(JSON.parse(content));
    if (maps && !parsed.googleMapsUrl) parsed.googleMapsUrl = maps;
    return finish(parsed, { mocked: false, model });
  } catch {
    return finish(mockEnrich(input.text, maps), {
      mocked: true,
      model: "mock-enrich-fallback",
    });
  }
}
