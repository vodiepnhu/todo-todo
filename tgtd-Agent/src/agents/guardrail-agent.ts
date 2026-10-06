import type { MutationDraft } from "./mutation-agent";
import type { PlannerRequest } from "../schemas/planner";
import { z } from "zod";
import { safeMapsRedirect } from "../lib/maps/maps";

const CLARIFY_CONFIDENCE = 0.45;

const MutationPayloadSchema = z
  .object({
    title: z.string().min(1).optional(),
    itemType: z.enum(["ACTIVITY", "TODO", "TOGO"]).optional(),
    subtype: z.string().optional(),
    googleMapsUrl: z.string().url().optional().or(z.literal("")).optional(),
    placeQuery: z.string().optional(),
    id: z.string().optional(),
    sourceText: z.string().optional(),
  })
  .passthrough();

/** Drop null / empty / non-URL maps values before Zod so they don't block confirm. */
function coerceMapsUrlField(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const raw = payload.googleMapsUrl;
  if (raw == null || raw === "" || typeof raw !== "string") {
    const { googleMapsUrl: _, ...rest } = payload;
    return rest;
  }
  try {
    // eslint-disable-next-line no-new
    new URL(raw);
    return payload;
  } catch {
    const { googleMapsUrl: _, ...rest } = payload;
    return rest;
  }
}

export type GuardrailOk = { ok: true; draft: MutationDraft };
export type GuardrailFail = { ok: false; reasons: string[] };
export type GuardrailResult = GuardrailOk | GuardrailFail;

export type GuardrailOptions = {
  safeMapsUrl?: (url: string) => string | null;
};

/** True when ingest is too uncertain to mutate safely. */
export function shouldClarify(
  planner: Pick<PlannerRequest, "intent" | "confidence" | "ambiguities" | "items">,
): boolean {
  if ((planner.ambiguities?.length ?? 0) > 0) return true;
  if ((planner.confidence ?? 0) < CLARIFY_CONFIDENCE) return true;
  return false;
}

/** Validate mutation draft before creating pending_action. */
export function validateMutationDraft(
  draft: MutationDraft,
  opts: GuardrailOptions = {},
): GuardrailResult {
  const reasons: string[] = [];
  const safeMaps = opts.safeMapsUrl ?? safeMapsRedirect;
  const payload = coerceMapsUrlField(draft.payload);

  if (draft.actionType === "CREATE") {
    const title = String(payload.title ?? "").trim();
    if (!title) reasons.push("CREATE requires a non-empty title");
  }

  if (draft.actionType === "UPDATE" || draft.actionType === "DELETE") {
    if (!payload.id && !payload.title) {
      reasons.push(`${draft.actionType} requires id or title reference`);
    }
  }

  const parsed = MutationPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    reasons.push(...parsed.error.issues.map((i) => i.message));
  }

  let maps = payload.googleMapsUrl as string | undefined;
  if (maps) {
    const trusted = safeMaps(maps);
    if (!trusted) {
      maps = undefined;
    } else {
      maps = trusted;
    }
  }

  const nestedPlan = payload.plan;
  if (nestedPlan && typeof nestedPlan === "object") {
    const plan = nestedPlan as { googleMapsUrl?: unknown };
    if (typeof plan.googleMapsUrl === "string" && plan.googleMapsUrl) {
      const trusted = safeMaps(plan.googleMapsUrl);
      if (!trusted) {
        reasons.push("plan contains an untrusted Google Maps URL");
      } else {
        (plan as { googleMapsUrl: string }).googleMapsUrl = trusted;
      }
    }
  }

  if (reasons.length) return { ok: false, reasons };

  return {
    ok: true,
    draft: {
      ...draft,
      payload: {
        ...payload,
        googleMapsUrl: maps,
        title:
          typeof payload.title === "string"
            ? payload.title.trim()
            : payload.title,
      },
      draftTitle:
        (typeof payload.title === "string" && payload.title.trim()) ||
        draft.draftTitle,
    },
  };
}

/** Validate pending payload again at confirm/execute time. */
export function validatePendingPayload(
  actionType: string,
  payload: Record<string, unknown>,
): { ok: true } | { ok: false; reasons: string[] } {
  if (actionType === "CREATE_PROJECT") {
    const name = String(payload.name ?? "").trim();
    if (!name) return { ok: false, reasons: ["CREATE_PROJECT requires name"] };
    return { ok: true };
  }
  return validateMutationDraft(
    {
      actionType: actionType as MutationDraft["actionType"],
      payload,
      draftTitle: String(payload.title ?? actionType),
    },
  );
}
