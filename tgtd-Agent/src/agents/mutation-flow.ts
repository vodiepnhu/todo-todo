import type { AgentName, SpanSummary } from "../lib/agentops/trace";
import { recordAgentEvent } from "../lib/agentops/agentops";
import { safeMapsRedirect } from "../lib/maps/maps";
import { extractPlanFromChat } from "../lib/ai/extract-plan";
import type { PlanFieldSummary } from "../lib/ai/extract-plan";
import { PlanSchema } from "../lib/plans/plan-schema";
import type { PlanDraft } from "../lib/plans/plan-schema";
import { buildMutationDraft } from "./mutation-agent";
import {
  formatClarifyReply,
  formatMutationReply,
} from "./communication-agent";
import { resolvePlace, type PlaceResolution } from "./places-agent";
import {
  shouldClarify,
  validateMutationDraft,
} from "./guardrail-agent";
import type {
  ActivePlanPending,
  OrchestratorDeps,
  PlannerProgressEvent,
} from "./types";
import type { PlannerRequest } from "../schemas/planner";
import type { Language } from "./language-agent";

type ActivePlan = { id: string; plan: PlanDraft } | null;

type RunSpan = <T>(
  agent: AgentName,
  fn: () => Promise<T> | T,
  opts?: {
    summary?: (result: T) => SpanSummary;
    payload?: (result: T) => unknown;
  },
) => Promise<T>;

function planPlaceChanged(basePlan: PlanDraft | undefined, plan: PlanDraft) {
  if (!basePlan) return true;
  return (
    basePlan.placeName.trim().toLowerCase() !==
    plan.placeName.trim().toLowerCase()
  );
}

function buildPlanPayload(plan: PlanDraft): Record<string, unknown> {
  return {
    schema: "plan",
    title: plan.placeName,
    placeQuery: plan.placeName,
    googleMapsUrl: plan.googleMapsUrl ?? undefined,
    plan,
  };
}

export function parseActivePlanPending(
  pending: ActivePlanPending | null | undefined,
): ActivePlan {
  if (!pending || pending.action_type !== "CREATE") return null;
  if (pending.state !== "AWAITING_CONFIRM_2") return null;
  const expiresAt = new Date(pending.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  const payload = pending.payload_json;
  if (payload?.schema !== "plan") return null;
  const parsed = PlanSchema.safeParse(payload.plan);
  return parsed.success ? { id: pending.id, plan: parsed.data } : null;
}

export async function runMutationFlow(input: {
  workspaceId: string;
  scope: "project" | "cross";
  planner: PlannerRequest;
  language: Language;
  cleanedMessage: string;
  userId: string;
  recentChat?: string;
  workspaceTimezone: string;
  activePlan: ActivePlan;
  deps: OrchestratorDeps;
  report: (event: PlannerProgressEvent) => Promise<void>;
  runSpan: RunSpan;
}): Promise<{ aiContent: string; pendingId: string | null }> {
  const { planner, deps } = input;
  const hasRecentPlanDraft = /(?:^|\n).*\bDraft:|\[Confirm\]\s*pending:/i.test(
    input.recentChat ?? "",
  );
  const planRequest =
    input.scope === "project" &&
    (planner.intent === "CREATE_ITEM" ||
      (planner.intent === "UPDATE_ITEM" && hasRecentPlanDraft));

  const item0 = planner.items[0] ?? {};
  let place: PlaceResolution = { degraded: false };
  await input.report({ step: "places", status: "active" });
  if (input.scope === "project" && !planRequest) {
    place = await input.runSpan(
      "places",
      () =>
        resolvePlace({
          message: input.cleanedMessage,
          placeQuery: item0.placeQuery,
          googleMapsUrl: item0.googleMapsUrl,
          extractMapsUrl: deps.extractMapsUrl,
          safeMapsUrl: deps.safeMapsUrl ?? safeMapsRedirect,
          searchPlace: deps.searchPlace,
        }),
      {
        summary: (result) => ({
          degraded: result.degraded,
          hasMapsUrl: Boolean(result.googleMapsUrl),
          placeName: result.name ?? undefined,
        }),
        payload: (result) => result,
      },
    );
  }
  await input.report({ step: "places", status: "done" });

  const items = planner.items.length
    ? [
        {
          ...item0,
          placeQuery: place.placeQuery ?? item0.placeQuery,
          googleMapsUrl: place.googleMapsUrl ?? item0.googleMapsUrl,
          title: item0.title || place.name || item0.title,
        },
        ...planner.items.slice(1),
      ]
    : planner.items;

  if (!planRequest) await input.report({ step: "draft", status: "active" });
  const draft = buildMutationDraft({
    intent: (planRequest && input.activePlan
      ? "CREATE_ITEM"
      : planner.intent) as
      | "CREATE_ITEM"
      | "UPDATE_ITEM"
      | "DELETE_ITEM"
      | "LOG_EVENT",
    message: input.cleanedMessage,
    items,
    event: planner.event,
    targetReference: planner.targetReference,
    extractMapsUrl: deps.extractMapsUrl,
  });
  if (!planRequest) await input.report({ step: "draft", status: "done" });

  let planReply:
    | {
        plan: PlanDraft;
        extracted?: PlanFieldSummary[];
        suggestions?: PlanFieldSummary[];
        missing?: string[];
      }
    | undefined;
  if (planRequest) {
    await input.report({ step: "draft", status: "active" });
    const extracted = await (deps.extractPlan ?? extractPlanFromChat)({
      userId: input.userId,
      text: [
        input.recentChat ? `Recent context:\n${input.recentChat}` : null,
        `Current request:\n${input.cleanedMessage}`,
      ]
        .filter(Boolean)
        .join("\n"),
      timezone: input.workspaceTimezone,
      lookupMaps: true,
      currentRequest: input.cleanedMessage,
      basePlan: input.activePlan?.plan,
      language: input.language,
    });
    await input.report({ step: "draft", status: "done" });

    if (
      input.activePlan &&
      (extracted.fallbackReason ||
        !PlanSchema.safeParse(extracted.draft).success ||
        !deps.updatePendingPlan)
    ) {
      recordAgentEvent({
        event: "plan_merge_rejected",
        workspaceId: input.workspaceId,
        intent: planner.intent,
        ok: false,
        meta: { reason: extracted.fallbackReason ?? "invalid_response" },
      });
      return {
        aiContent: [
          "I couldn't update that draft. Please try again with your correction.",
          "The existing draft is unchanged. Type CONFIRM to save it.",
          `[Confirm] pending:${input.activePlan.id}`,
        ].join("\n"),
        pendingId: input.activePlan.id,
      };
    }

    const changedPlace = planPlaceChanged(input.activePlan?.plan, extracted.draft);
    const currentRequestMapsUrl = deps.extractMapsUrl(input.cleanedMessage);
    const extractorRanMapsLookup = Object.prototype.hasOwnProperty.call(
      extracted,
      "mapsDegraded",
    );
    const trustedExtractedMaps =
      extracted.mapsMetadataTrusted === true && Boolean(extracted.draft.googleMapsUrl);
    const mergedTrustedMapsUrl =
      (trustedExtractedMaps && extracted.draft.googleMapsUrl) ||
      (!changedPlace ? input.activePlan?.plan.googleMapsUrl : undefined);
    if (currentRequestMapsUrl || (!extractorRanMapsLookup && !mergedTrustedMapsUrl)) {
      place = await input.runSpan(
        "places",
        () =>
          resolvePlace({
            message: input.cleanedMessage,
            placeQuery: extracted.draft.placeName || item0.placeQuery || item0.title,
            extractMapsUrl: deps.extractMapsUrl,
            safeMapsUrl: deps.safeMapsUrl ?? safeMapsRedirect,
            searchPlace: deps.searchPlace,
          }),
        {
          summary: (result) => ({
            degraded: result.degraded,
            hasMapsUrl: Boolean(result.googleMapsUrl),
            placeName: result.name ?? undefined,
          }),
          payload: (result) => result,
        },
      );
    }
    const useExtractedMapsMetadata =
      extractorRanMapsLookup || extracted.mapsMetadataTrusted === true;
    const keepBaseMetadata =
      !changedPlace &&
      (!place.googleMapsUrl || place.googleMapsUrl === input.activePlan?.plan.googleMapsUrl);
    const parsedPlan = PlanSchema.safeParse({
      ...extracted.draft,
      placeName:
        place.name ||
        extracted.draft.placeName ||
        (!input.activePlan ? item0.placeQuery || item0.title : ""),
      location:
        place.formattedAddress ??
        (useExtractedMapsMetadata ? extracted.draft.location : null) ??
        (keepBaseMetadata ? input.activePlan?.plan.location : null),
      googleMapsUrl:
        place.googleMapsUrl ??
        (useExtractedMapsMetadata ? extracted.draft.googleMapsUrl : null) ??
        (!changedPlace ? input.activePlan?.plan.googleMapsUrl : null),
      googlePlaceId:
        place.googlePlaceId ??
        (useExtractedMapsMetadata ? extracted.draft.googlePlaceId : null) ??
        (keepBaseMetadata ? input.activePlan?.plan.googlePlaceId : null),
      latitude:
        place.latitude ??
        (useExtractedMapsMetadata ? extracted.draft.latitude : null) ??
        (keepBaseMetadata ? input.activePlan?.plan.latitude : null),
      longitude:
        place.longitude ??
        (useExtractedMapsMetadata ? extracted.draft.longitude : null) ??
        (keepBaseMetadata ? input.activePlan?.plan.longitude : null),
      sourceText: input.cleanedMessage,
    });
    if (!parsedPlan.success) {
      if (input.activePlan) {
        return {
          aiContent: await input.runSpan(
            "communication",
            () =>
              [
                "I couldn't update that draft because the merged plan was invalid.",
                "",
                "Nothing was saved. Type a correction or CONFIRM the existing draft.",
                `[Confirm] pending:${input.activePlan!.id}`,
              ].join("\n"),
            {
              summary: () => ({ replyKind: "mutation" }),
              payload: (content) => ({ content }),
            },
          ),
          pendingId: input.activePlan.id,
        };
      }
      throw parsedPlan.error;
    }
    const plan = parsedPlan.data;
    planReply = {
      plan,
      extracted: extracted.extracted,
      suggestions: extracted.suggestions,
      missing: extracted.missing,
    };
    draft.payload = buildPlanPayload(plan);
    draft.draftTitle = plan.placeName;
  }

  if (!planRequest && place.googlePlaceId) {
    draft.payload.googlePlaceId = place.googlePlaceId;
  }
  if (!planRequest && place.formattedAddress) {
    draft.payload.formattedAddress = place.formattedAddress;
  }
  if (!planRequest && place.degraded && place.note) {
    draft.payload.placeDegraded = true;
    draft.payload.placeNote = place.note;
  }

  await input.report({ step: "check", status: "active" });
  const gated = await input.runSpan(
    "guardrail",
    () =>
      validateMutationDraft(draft, {
        safeMapsUrl: deps.safeMapsUrl ?? safeMapsRedirect,
      }),
    {
      summary: (result) =>
        result.ok
          ? { clarify: false }
          : { clarify: true, reasons: result.reasons },
      payload: (result) => result,
    },
  );
  await input.report({ step: "check", status: "done" });

  if (!gated.ok) {
    return {
      aiContent: await input.runSpan(
        "communication",
        () =>
          formatClarifyReply({
            baseReply: planner.reply,
            reasons: gated.reasons,
            language: input.language,
          }),
        {
          summary: () => ({ replyKind: "clarify" }),
          payload: (content) => ({ content }),
        },
      ),
      pendingId: null,
    };
  }

  await input.report({ step: "save", status: "active" });
  const pending =
    planRequest && input.activePlan && deps.updatePendingPlan
      ? await input.runSpan(
          "mutation",
          () =>
            deps.updatePendingPlan!(
              input.activePlan!.id,
              input.workspaceId,
              input.userId,
              gated.draft.payload,
            ),
          {
            summary: () => ({
              actionType: gated.draft.actionType,
              draftTitle: gated.draft.draftTitle,
            }),
            payload: () => ({
              actionType: gated.draft.actionType,
              payload: gated.draft.payload,
            }),
          },
        )
      : await input.runSpan(
          "mutation",
          () =>
            deps.createPending({
              workspaceId: input.workspaceId,
              actionType: gated.draft.actionType,
              payload: gated.draft.payload,
              baseVersion: null,
              userId: input.userId,
            }),
          {
            summary: () => ({
              actionType: gated.draft.actionType,
              draftTitle: gated.draft.draftTitle,
            }),
            payload: () => ({
              actionType: gated.draft.actionType,
              payload: gated.draft.payload,
            }),
          },
        );
  await input.report({ step: "save", status: "done" });

  const placeHint = place.degraded
    ? " (place lookup degraded)"
    : place.googleMapsUrl
      ? " (maps link attached)"
      : "";
  return {
    aiContent: await input.runSpan(
      "communication",
      () =>
        formatMutationReply({
          baseReply: `${planner.reply ?? ""}${placeHint}`.trim(),
          draftTitle: gated.draft.draftTitle,
          actionType: gated.draft.actionType,
          pendingId: pending.id,
          plan: planReply?.plan,
          extracted: planReply?.extracted,
          suggestions: planReply?.suggestions,
          missing: planReply?.missing,
          language: input.language,
        }),
      {
        summary: () => ({ replyKind: "mutation" }),
        payload: (content) => ({ content }),
      },
    ),
    pendingId: pending.id,
  };
}
