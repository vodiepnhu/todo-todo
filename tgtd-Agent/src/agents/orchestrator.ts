import { env } from "../lib/env";
import { buildMutationDraft } from "./mutation-agent";
import {
  formatClarifyReply,
  formatHelpReply,
  formatMutationReply,
  formatPickProjectReply,
  formatRecommendReply,
  formatRefuseReply,
} from "./communication-agent";
import { runRagAgent } from "./rag-agent";
import { resolvePlace } from "./places-agent";
import {
  shouldClarify,
  validateMutationDraft,
} from "./guardrail-agent";
import { evaluatePolicy } from "./policy-agent";
import { recordAgentEvent } from "../lib/agentops/agentops";
import type {
  AgentName,
  AgentTrace,
  SpanSummary,
} from "../lib/agentops/trace";
import { safeMapsRedirect } from "../lib/maps/maps";
import { extractPlanFromChat } from "../lib/ai/extract-plan";
import { PlanSchema } from "../lib/plans/plan-schema";
import type {
  OrchestratorDeps,
  OrchestratorResult,
} from "./types";
import type { ChatScope } from "../lib/chat-scope";
import {
  resolveProjectFromMessage,
  shouldAskProjectBeforeMutate,
  stripAllPrefix,
} from "../lib/chat-scope";

const MUTATE_INTENTS = new Set([
  "CREATE_ITEM",
  "UPDATE_ITEM",
  "DELETE_ITEM",
  "LOG_EVENT",
]);

const RECOMMEND_INTENTS = new Set([
  "RECOMMEND_TASK",
  "RECOMMEND_PLACE",
  "RECOMMEND_BOTH",
]);

const RAG_INTENTS = new Set([
  ...RECOMMEND_INTENTS,
  "LIST_ITEMS",
  "GET_ITEM",
  "LIST_HISTORY",
  "HELP",
]);

async function runSpan<T>(
  trace: AgentTrace | undefined,
  agent: AgentName,
  fn: () => Promise<T> | T,
  opts?: {
    summary?: (result: T) => SpanSummary;
    payload?: (result: T) => unknown;
  },
): Promise<T> {
  if (!trace) return await fn();
  return trace.span(agent, fn, opts);
}

/**
 * Orchestrator — routes ingest → Policy → Places? → Guardrail → Mutation | RAG | Communication.
 * Mutation only creates pending_actions (single confirm).
 */
export async function runPlannerOrchestrator(input: {
  workspaceId: string | null;
  scope?: ChatScope;
  memberWorkspaceIds?: string[];
  memberProjects?: Array<{ id: string; name: string }>;
  message: string;
  userId: string;
  currentDate?: string;
  currentDatetime?: string;
  workspaceTimezone?: string;
  recentChat?: string;
  trace?: AgentTrace;
  deps: OrchestratorDeps;
}): Promise<OrchestratorResult> {
  const scope: ChatScope =
    input.scope ?? (input.workspaceId ? "project" : "cross");
  const memberProjects = input.memberProjects ?? [];
  const memberWorkspaceIds =
    input.memberWorkspaceIds ??
    (input.workspaceId ? [input.workspaceId] : memberProjects.map((p) => p.id));

  const tz = input.workspaceTimezone ?? env.DEFAULT_TIMEZONE;
  const now = new Date();
  const currentDate =
    input.currentDate ??
    now.toLocaleDateString("en-CA", { timeZone: tz });
  const currentDatetime =
    input.currentDatetime ??
    now.toLocaleString("en-AU", { timeZone: tz });

  const cleanedMessage = stripAllPrefix(input.message);
  const trace = input.trace;

  const ingest = await runSpan(
    trace,
    "ingest",
    () =>
      input.deps.ingest({
        message: cleanedMessage,
        currentDate,
        currentDatetime,
        workspaceTimezone: tz,
        userId: input.userId,
        recentChat: input.recentChat,
      }),
    {
      summary: (r) => ({
        intent: r.request.intent,
        confidence: r.request.confidence,
        model: r.model,
        mocked: r.mocked,
      }),
      payload: (r) => ({ request: r.request, model: r.model }),
    },
  );

  const planner = ingest.request;

  const policy = await runSpan(
    trace,
    "policy",
    () =>
      evaluatePolicy({
        message: cleanedMessage,
        planner,
      }),
    {
      summary: (r) =>
        r.decision === "refuse"
          ? { decision: r.decision, reason: r.reason }
          : { decision: r.decision },
      payload: (r) => r,
    },
  );

  if (policy.decision === "refuse") {
    recordAgentEvent({
      event: "policy_refuse",
      workspaceId: input.workspaceId ?? undefined,
      intent: planner.intent,
      ok: true,
      meta: { reason: policy.reason },
    });
    const aiContent = await runSpan(
      trace,
      "communication",
      () => formatRefuseReply(),
      {
        summary: () => ({ replyKind: "refuse" }),
        payload: (c) => ({ content: c }),
      },
    );
    return {
      planner,
      aiContent,
      pendingId: null,
      model: ingest.model,
      mocked: ingest.mocked,
      latencyMs: ingest.latencyMs,
      provider: ingest.provider,
    };
  }

  let pendingId: string | null = null;
  let aiContent = formatHelpReply(planner.reply);
  let replyKind:
    | "help"
    | "refuse"
    | "clarify"
    | "recommend"
    | "mutation"
    | "pick_project" = "help";

  if (RAG_INTENTS.has(planner.intent)) {
    const ids =
      scope === "cross"
        ? memberWorkspaceIds
        : input.workspaceId
          ? [input.workspaceId]
          : memberWorkspaceIds;
    const rag = await runSpan(
      trace,
      "rag",
      () =>
        runRagAgent({
          intent: planner.intent,
          workspaceIds: ids,
          query: planner.recommendationQuery || cleanedMessage,
          listItems: input.deps.listItems,
          retrieve: input.deps.retrieve,
        }),
      {
        summary: (r) => ({ candidateCount: r.candidates.length }),
        payload: (r) => ({
          candidateIds: r.candidates.slice(0, 10).map((c) => c.item.id),
        }),
      },
    );
    const { candidates, projectByItemId } = rag;
    if (scope === "cross") {
      for (const c of candidates) {
        if (!projectByItemId.has(c.item.id)) {
          const proj = memberProjects.find((p) => p.id === c.item.workspace_id);
          if (proj) projectByItemId.set(c.item.id, proj.name);
        }
      }
    }
    if (RECOMMEND_INTENTS.has(planner.intent)) {
      replyKind = "recommend";
      aiContent = formatRecommendReply({
        intent: planner.intent,
        candidates,
        projectByItemId: scope === "cross" ? projectByItemId : undefined,
      });
    } else if (candidates.length > 0) {
      replyKind = "recommend";
      const top = candidates.slice(0, 5);
      const lines = top.map((c, i) => {
        const proj = projectByItemId.get(c.item.id);
        const prefix = proj ? `[${proj}] ` : "";
        return `${i + 1}. ${prefix}${c.item.title}`;
      });
      const chatNote = input.recentChat
        ? "\n(Also considered recent chat — soft-deleted messages excluded.)"
        : "";
      aiContent = `${planner.reply || "Here is what I found in your saved data:"}\n\n${lines.join("\n")}${chatNote}`;
    }

    aiContent = await runSpan(
      trace,
      "communication",
      () => aiContent,
      {
        summary: () => ({ replyKind }),
        payload: (c) => ({ content: c }),
      },
    );
  } else if (MUTATE_INTENTS.has(planner.intent)) {
    let wsId = input.workspaceId;

    if (scope === "cross") {
      const resolved = resolveProjectFromMessage(cleanedMessage, memberProjects);
      if (resolved.kind === "create") {
        const pending = await runSpan(
          trace,
          "mutation",
          () =>
            input.deps.createPending({
              workspaceId: null,
              actionType: "CREATE_PROJECT",
              payload: {
                name: resolved.name,
                chainedMessage: cleanedMessage,
                intent: planner.intent,
                items: planner.items,
                event: planner.event,
                targetReference: planner.targetReference,
              },
              baseVersion: null,
              userId: input.userId,
            }),
          {
            summary: () => ({
              actionType: "CREATE_PROJECT",
              draftTitle: `New project: ${resolved.name}`,
            }),
            payload: () => ({ name: resolved.name }),
          },
        );
        pendingId = pending.id;
        aiContent = await runSpan(
          trace,
          "communication",
          () =>
            formatMutationReply({
              baseReply: `I'll create project "${resolved.name}" first.`,
              draftTitle: `New project: ${resolved.name}`,
              actionType: "CREATE_PROJECT",
              pendingId: pending.id,
            }),
          {
            summary: () => ({ replyKind: "mutation" }),
            payload: (c) => ({ content: c }),
          },
        );
        return {
          planner,
          aiContent,
          pendingId,
          model: ingest.model,
          mocked: ingest.mocked,
          latencyMs: ingest.latencyMs,
          provider: ingest.provider,
        };
      }
      if (resolved.kind === "existing") {
        wsId = resolved.workspaceId;
      } else if (
        shouldAskProjectBeforeMutate({
          scope: "cross",
          intent: planner.intent,
          resolvedWorkspaceId: null,
        })
      ) {
        aiContent = await runSpan(
          trace,
          "communication",
          () =>
            formatPickProjectReply({
              baseReply: planner.reply,
              projects: memberProjects,
            }),
          {
            summary: () => ({ replyKind: "pick_project" }),
            payload: (c) => ({ content: c }),
          },
        );
        return {
          planner,
          aiContent,
          pendingId: null,
          model: ingest.model,
          mocked: ingest.mocked,
          latencyMs: ingest.latencyMs,
          provider: ingest.provider,
        };
      }
    }

    if (!wsId) {
      aiContent = await runSpan(
        trace,
        "communication",
        () =>
          formatPickProjectReply({
            baseReply: planner.reply,
            projects: memberProjects,
          }),
        {
          summary: () => ({ replyKind: "pick_project" }),
          payload: (c) => ({ content: c }),
        },
      );
    } else if (shouldClarify(planner)) {
      aiContent = await runSpan(
        trace,
        "communication",
        () =>
          formatClarifyReply({
            baseReply: planner.reply,
            ambiguities: planner.ambiguities,
          }),
        {
          summary: () => ({ replyKind: "clarify" }),
          payload: (c) => ({ content: c }),
        },
      );
    } else {
      const item0 = planner.items[0] ?? {};
      const place = await runSpan(
        trace,
        "places",
        () =>
          resolvePlace({
            message: cleanedMessage,
            placeQuery: item0.placeQuery,
            googleMapsUrl: item0.googleMapsUrl,
            extractMapsUrl: input.deps.extractMapsUrl,
            safeMapsUrl: input.deps.safeMapsUrl ?? safeMapsRedirect,
            searchPlace: input.deps.searchPlace,
          }),
        {
          summary: (p) => ({
            degraded: p.degraded,
            hasMapsUrl: Boolean(p.googleMapsUrl),
            placeName: p.name ?? undefined,
          }),
          payload: (p) => p,
        },
      );

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

      const draft = buildMutationDraft({
        intent: planner.intent as
          | "CREATE_ITEM"
          | "UPDATE_ITEM"
          | "DELETE_ITEM"
          | "LOG_EVENT",
        message: cleanedMessage,
        items,
        event: planner.event,
        targetReference: planner.targetReference,
        extractMapsUrl: input.deps.extractMapsUrl,
      });

      if (item0.placeQuery || place.placeQuery || place.name) {
        const extracted = await (input.deps.extractPlan ?? extractPlanFromChat)({
          userId: input.userId,
          text: [input.recentChat, cleanedMessage].filter(Boolean).join("\n"),
          timezone: tz,
          lookupMaps: false,
        });
        const plan = PlanSchema.parse({
          ...extracted.draft,
          placeName: place.name || extracted.draft.placeName || item0.placeQuery || item0.title,
          location: place.formattedAddress ?? extracted.draft.location,
          googleMapsUrl: place.googleMapsUrl ?? extracted.draft.googleMapsUrl,
          googlePlaceId: place.googlePlaceId ?? extracted.draft.googlePlaceId,
          latitude: place.latitude ?? extracted.draft.latitude,
          longitude: place.longitude ?? extracted.draft.longitude,
          sourceText: cleanedMessage,
        });
        draft.payload = {
          ...draft.payload,
          schema: "plan",
          title: plan.placeName,
          placeQuery: plan.placeName,
          googleMapsUrl: plan.googleMapsUrl ?? undefined,
          plan,
        };
      }

      if (place.googlePlaceId) {
        draft.payload.googlePlaceId = place.googlePlaceId;
      }
      if (place.formattedAddress) {
        draft.payload.formattedAddress = place.formattedAddress;
      }
      if (place.degraded && place.note) {
        draft.payload.placeDegraded = true;
        draft.payload.placeNote = place.note;
      }

      const gated = await runSpan(
        trace,
        "guardrail",
        () =>
          validateMutationDraft(draft, {
            safeMapsUrl: input.deps.safeMapsUrl ?? safeMapsRedirect,
          }),
        {
          summary: (g) =>
            g.ok
              ? { clarify: false }
              : { clarify: true, reasons: g.reasons },
          payload: (g) => g,
        },
      );

      if (!gated.ok) {
        aiContent = await runSpan(
          trace,
          "communication",
          () =>
            formatClarifyReply({
              baseReply: planner.reply,
              reasons: gated.reasons,
            }),
          {
            summary: () => ({ replyKind: "clarify" }),
            payload: (c) => ({ content: c }),
          },
        );
      } else {
        const pending = await runSpan(
          trace,
          "mutation",
          () =>
            input.deps.createPending({
              workspaceId: wsId,
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
        pendingId = pending.id;
        const placeHint = place.degraded
          ? " (place lookup degraded)"
          : place.googleMapsUrl
            ? " (maps link attached)"
            : "";
        aiContent = await runSpan(
          trace,
          "communication",
          () =>
            formatMutationReply({
              baseReply: `${planner.reply ?? ""}${placeHint}`.trim(),
              draftTitle: gated.draft.draftTitle,
              actionType: gated.draft.actionType,
              pendingId: pending.id,
            }),
          {
            summary: () => ({ replyKind: "mutation" }),
            payload: (c) => ({ content: c }),
          },
        );
      }
    }
  } else {
    aiContent = await runSpan(
      trace,
      "communication",
      () => aiContent,
      {
        summary: () => ({ replyKind: "help" }),
        payload: (c) => ({ content: c }),
      },
    );
  }

  return {
    planner,
    aiContent,
    pendingId,
    model: ingest.model,
    mocked: ingest.mocked,
    latencyMs: ingest.latencyMs,
    provider: ingest.provider,
  };
}
