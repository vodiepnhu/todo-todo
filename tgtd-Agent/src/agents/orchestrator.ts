import { env } from "../lib/env";
import {
  formatClarifyReply,
  formatHelpReply,
  formatAskOnlyReply,
  formatAddScopeUnavailableReply,
  formatMutationReply,
  formatPickProjectReply,
  formatScheduleDeclinedReply,
  formatScheduleQuestion,
  formatRefuseReply,
  formatWebSearchNone,
  formatWebSearchResults,
} from "./communication-agent";
import { evaluatePolicy } from "./policy-agent";
import { recordAgentEvent } from "../lib/agentops/agentops";
import type {
  AgentName,
  AgentTrace,
  SpanSummary,
} from "../lib/agentops/trace";
import type {
  OrchestratorDeps,
  OrchestratorResult,
  PlannerProgressEvent,
} from "./types";
import type { ChatScope } from "../lib/chat-scope";
import {
  resolveProjectFromMessage,
  shouldAskProjectBeforeMutate,
  stripAllPrefix,
} from "../lib/chat-scope";
import { runLanguageAgent, type Language } from "./language-agent";
import {
  RAG_INTENTS,
  resolveRecommendationTurn,
  runRecommendationFlow,
} from "./recommendation-flow";
import {
  parseActivePlanPending,
  runMutationFlow,
} from "./mutation-flow";
import { shouldClarify } from "./guardrail-agent";
import { matchesGreeting } from "../lib/policy/patterns";
import { normalizePlannerRequest } from "../lib/ai/openrouter";

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

function hasExplicitCreateRequest(message: string): boolean {
  const userMessage = (message.split(/\s*\(Context:/i, 1)[0] ?? message).trim();
  return /\b(?:add|save|create|plan|schedule|remind|put|thêm|lưu|tạo|lập\s+kế\s+hoạch|nhắc)\b|lên\s+lịch|đặt\s+lịch/i.test(
    userMessage,
  );
}

function projectForReadQuery(
  message: string,
  projects: Array<{ id: string; name: string }>,
): string | null {
  const userMessage = (message.split(/\s*\(Context:/i, 1)[0] ?? message).trim().toLocaleLowerCase();
  return projects.find((project) => userMessage.includes(project.name.toLocaleLowerCase()))?.id ?? null;
}

function isPlanClarificationFollowUp(message: string, recentChat?: string): boolean {
  if (!/(?:^|\n).*\bDraft:|\[Confirm\]\s*pending:/i.test(recentChat ?? "")) {
    return false;
  }
  const current = message.trim();
  if (!current || matchesGreeting(current) || /^(?:no|nah|cancel|stop)\b/i.test(current)) {
    return false;
  }
  return /^(?:yes|yeah|y|correct|right|that's|that is)\b/i.test(current) ||
    /\b(?:that's|that is|it is|correct|right)\b/i.test(current) ||
    /\b(?:add|also|include|change|update|remove|cost|costs|budget|price|expense|food|eat(?:ing)?|meal|restaurant|tram|transport|travel|fare|ticket|date|day|time|duration|hours?|minutes?|note|preparation|prepare|booking|weather|estimate|estimated|how about|what about|give me|for \d+ days?)\b/i.test(current);
}

function needsRetrievedContext(message: string, recentChat?: string): boolean {
  if (!recentChat?.trim()) return false;
  const current = (message.split(/\s*\(Context:/i, 1)[0] ?? message).trim();
  const words = current.split(/\s+/).filter(Boolean).length;
  const referencesContext = /\b(?:it|that|this|them|same|selected|option|one|yes|no|again|instead|change|move|update)\b|(?:đó|này|vừa\s+chọn|như\s+trên|tiếp|lại|đổi|sang|nó|cái\s+đó)/i.test(current);
  if (referencesContext) return true;
  if (words > 4) return false;
  return !/^(?:add|save|create|schedule|remind|thêm|lưu|tạo|lập\s+kế\s+hoạch|nhắc)\b/i.test(current);
}

function formatRetrievedContext(
  hits: Array<{
    sourceId: string;
    chunkText: string;
    score: number;
    projectName?: string;
    channel?: string;
  }>,
): string | undefined {
  if (!hits.length) return undefined;
  return hits
    .slice(0, 8)
    .map((hit, index) =>
      `[${index + 1}] ${hit.channel ?? "context"} ${hit.projectName ?? ""}`.trim() +
      `\n${hit.chunkText.slice(0, 500)}`,
    )
    .join("\n\n");
}

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
  onProgress?: (event: PlannerProgressEvent) => void | Promise<void>;
  readOnly?: boolean;
  addRequiresProject?: boolean;
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
    input.currentDate ?? now.toLocaleDateString("en-CA", { timeZone: tz });
  const currentDatetime =
    input.currentDatetime ?? now.toLocaleString("en-AU", { timeZone: tz });
  const cleanedMessage = stripAllPrefix(input.message);
  const trace = input.trace;
  const language: Language = (
    await runSpan(
      trace,
      "language",
      () => runLanguageAgent({ message: cleanedMessage }),
      { summary: (result) => ({ language: result.language }) },
    )
  ).language;
  const activePlanPendingPromise =
    scope === "project" && input.workspaceId && input.deps.findActivePlanPending
      ? input.deps.findActivePlanPending(input.workspaceId, input.userId)
      : Promise.resolve(null);
  const contextWorkspaceIds =
    scope === "project" && input.workspaceId
      ? [input.workspaceId]
      : memberWorkspaceIds;
  const retrievedContextPromise =
    input.deps.retrieve && needsRetrievedContext(cleanedMessage, input.recentChat)
      ? input.deps.retrieve(contextWorkspaceIds, cleanedMessage).catch(() => [])
      : Promise.resolve([]);
  const report = async (event: PlannerProgressEvent) => {
    try {
      await input.onProgress?.(event);
    } catch {
      // Progress transport must not break planner execution.
    }
  };

  await report({ step: "understand", status: "active" });
  const retrievedContext = formatRetrievedContext(
    await retrievedContextPromise,
  );
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
        retrievedContext,
        language,
      }),
    {
      summary: (result) => ({
        intent: result.request.intent,
        confidence: result.request.confidence,
        model: result.model,
        mocked: result.mocked,
      }),
      payload: (result) => ({ request: result.request, model: result.model }),
    },
  );
  let planner = normalizePlannerRequest(cleanedMessage, ingest.request);
  if (matchesGreeting(cleanedMessage)) {
    planner = {
      ...planner,
      intent: "HELP",
      confidence: 1,
      ambiguities: [],
      reply:
        language === "vi"
          ? "Chào bạn! Tôi có thể giúp bạn lập kế hoạch địa điểm và hoạt động."
          : "Hi! I can help you plan places and activities.",
    };
  }
  const activePlanFollowUp =
    scope === "project" &&
    input.workspaceId &&
    input.deps.findActivePlanPending &&
    isPlanClarificationFollowUp(cleanedMessage, input.recentChat)
      ? parseActivePlanPending(await activePlanPendingPromise)
      : null;
  if (
    activePlanFollowUp &&
    (planner.intent === "UNKNOWN" || planner.intent === "HELP")
  ) {
    planner = {
      ...planner,
      intent: "UPDATE_ITEM",
      confidence: 0.9,
      ambiguities: [],
      reply: undefined,
      targetReference: activePlanFollowUp.plan.placeName,
    };
  }
  const explicitCreate = hasExplicitCreateRequest(cleanedMessage);
  if (
    explicitCreate &&
    (RECOMMEND_INTENTS.has(planner.intent) || planner.intent === "CREATE_ITEM")
  ) {
    planner = {
      ...planner,
      intent: "CREATE_ITEM",
      confidence: Math.max(planner.confidence, 0.9),
      ambiguities: [],
      recommendationQuery: undefined,
      event: undefined,
      reply:
        planner.reply &&
        !/(?:would you like|do you want|should i|want me to|bạn có muốn|có muốn)/i.test(
          planner.reply,
        )
          ? planner.reply
          : undefined,
    };
  }
  if (input.readOnly && MUTATE_INTENTS.has(planner.intent)) {
    planner = {
      ...planner,
      intent: "HELP",
      ambiguities: [],
      reply: formatAskOnlyReply(language),
    };
  }
  await report({ step: "understand", status: "done" });

  if (input.addRequiresProject) {
    await report({ step: "complete", status: "done" });
    return {
      planner,
      aiContent: formatAddScopeUnavailableReply(language),
      pendingId: null,
      model: ingest.model,
      mocked: ingest.mocked,
      latencyMs: ingest.latencyMs,
      provider: ingest.provider,
    };
  }

  if (ingest.mocked && ingest.model === "mock-fallback") {
    await report({ step: "complete", status: "done" });
    return {
      planner,
      aiContent: formatHelpReply(planner.reply, language),
      pendingId: null,
      model: ingest.model,
      mocked: true,
      latencyMs: ingest.latencyMs,
      provider: ingest.provider,
    };
  }

  const recommendationTurn = resolveRecommendationTurn({
    message: cleanedMessage,
    recentChat: input.recentChat,
  });
  if (recommendationTurn?.kind === "selection") {
    if (input.readOnly) {
      await report({ step: "complete", status: "done" });
      return {
        planner,
        aiContent: formatAskOnlyReply(language),
        pendingId: null,
        model: ingest.model,
        mocked: ingest.mocked,
        latencyMs: ingest.latencyMs,
        provider: ingest.provider,
      };
    }
    await report({ step: "complete", status: "done" });
    return {
      planner,
      aiContent: await runSpan(
        trace,
        "communication",
        () => formatScheduleQuestion(recommendationTurn.place, language),
        {
          summary: () => ({ replyKind: "recommend_schedule_gate" }),
          payload: (content) => ({ content }),
        },
      ),
      pendingId: null,
      model: ingest.model,
      mocked: ingest.mocked,
      latencyMs: ingest.latencyMs,
      provider: ingest.provider,
    };
  }
  if (recommendationTurn?.kind === "schedule_declined") {
    await report({ step: "complete", status: "done" });
    return {
      planner,
      aiContent: await runSpan(
        trace,
        "communication",
        () => formatScheduleDeclinedReply(language),
        {
          summary: () => ({ replyKind: "recommend_schedule_declined" }),
          payload: (content) => ({ content }),
        },
      ),
      pendingId: null,
      model: ingest.model,
      mocked: ingest.mocked,
      latencyMs: ingest.latencyMs,
      provider: ingest.provider,
    };
  }
  if (recommendationTurn?.kind === "web_search_declined") {
    await report({ step: "complete", status: "done" });
    return {
      planner,
      aiContent: formatWebSearchNone(language),
      pendingId: null,
      model: ingest.model,
      mocked: ingest.mocked,
      latencyMs: ingest.latencyMs,
      provider: ingest.provider,
    };
  }
  if (recommendationTurn?.kind === "web_search_confirmed") {
    const found = input.deps.searchPlace
      ? await input.deps.searchPlace(recommendationTurn.query)
      : { degraded: true, results: [] };
    const results = found.results.slice(0, 5).map((result) => ({
      name: result.name,
      formattedAddress: result.formattedAddress,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result.name)}`,
    }));
    await report({ step: "complete", status: "done" });
    return {
      planner,
      aiContent: found.degraded || !results.length
        ? formatWebSearchNone(language)
        : formatWebSearchResults(results, language),
      pendingId: null,
      model: ingest.model,
      mocked: ingest.mocked,
      latencyMs: ingest.latencyMs,
      provider: ingest.provider,
    };
  }
  let mutationMessage = cleanedMessage;
  if (recommendationTurn?.kind === "schedule_confirmed") {
    planner = {
      ...planner,
      intent: "CREATE_ITEM",
      confidence: 1,
      targetReference: recommendationTurn.place,
      recommendationQuery: undefined,
      event: undefined,
      items: [
        {
          itemType: "ACTIVITY",
          subtype: "TASK",
          title: recommendationTurn.place,
          placeQuery: recommendationTurn.place,
        },
      ],
    };
    mutationMessage = `Schedule ${recommendationTurn.place}`;
  }

  const policy = await runSpan(
    trace,
    "policy",
    () => evaluatePolicy({ message: cleanedMessage, planner }),
    {
      summary: (result) =>
        result.decision === "refuse"
          ? { decision: result.decision, reason: result.reason }
          : { decision: result.decision },
      payload: (result) => result,
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
      () => formatRefuseReply(language),
      {
        summary: () => ({ replyKind: "refuse" }),
        payload: (content) => ({ content }),
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

  let aiContent = formatHelpReply(planner.reply, language);
  let pendingId: string | null = null;

  if (RAG_INTENTS.has(planner.intent)) {
    const requestedProjectId =
      scope === "cross" ? projectForReadQuery(cleanedMessage, memberProjects) : null;
    const ids =
      scope === "cross"
        ? requestedProjectId
          ? [requestedProjectId]
          : memberWorkspaceIds
        : input.workspaceId
          ? [input.workspaceId]
          : memberWorkspaceIds;
    const recommendation = await runRecommendationFlow({
      planner,
      language,
      scope,
      workspaceIds: ids,
      memberProjects,
      cleanedMessage,
      recentChat: input.recentChat,
      deps: input.deps,
      report,
      runSpan: (agent, fn, opts) => runSpan(trace, agent, fn, opts),
      fallbackContent: aiContent,
    });
    aiContent = recommendation.aiContent;
  } else if (MUTATE_INTENTS.has(planner.intent)) {
    let workspaceId = input.workspaceId;
    await report({ step: "context", status: "active" });

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
        aiContent = await runSpan(
          trace,
          "communication",
          () =>
            formatMutationReply({
              baseReply: `I'll create project "${resolved.name}" first.`,
              draftTitle: `New project: ${resolved.name}`,
              actionType: "CREATE_PROJECT",
              pendingId: pending.id,
              language,
            }),
          {
            summary: () => ({ replyKind: "mutation" }),
            payload: (content) => ({ content }),
          },
        );
        return {
          planner,
          aiContent,
          pendingId: pending.id,
          model: ingest.model,
          mocked: ingest.mocked,
          latencyMs: ingest.latencyMs,
          provider: ingest.provider,
        };
      }
      if (resolved.kind === "existing") {
        workspaceId = resolved.workspaceId;
      } else if (
        shouldAskProjectBeforeMutate({
          scope: "cross",
          intent: planner.intent,
          resolvedWorkspaceId: null,
        })
      ) {
        await report({ step: "context", status: "done" });
        aiContent = await runSpan(
          trace,
          "communication",
          () =>
            formatPickProjectReply({
              baseReply: planner.reply,
              projects: memberProjects,
              language,
            }),
          {
            summary: () => ({ replyKind: "pick_project" }),
            payload: (content) => ({ content }),
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

    const activePlan =
      scope === "project" &&
      (planner.intent === "CREATE_ITEM" || planner.intent === "UPDATE_ITEM") &&
      workspaceId &&
      input.deps.findActivePlanPending
        ? parseActivePlanPending(await activePlanPendingPromise)
        : null;
    await report({ step: "context", status: "done" });

    if (!workspaceId) {
      aiContent = await runSpan(
        trace,
        "communication",
        () =>
          formatPickProjectReply({
            baseReply: planner.reply,
            projects: memberProjects,
            language,
          }),
        {
          summary: () => ({ replyKind: "pick_project" }),
          payload: (content) => ({ content }),
        },
      );
    } else if (!activePlan && shouldClarify(planner)) {
      aiContent = await runSpan(
        trace,
        "communication",
        () =>
          formatClarifyReply({
            baseReply: planner.reply,
            ambiguities: planner.ambiguities,
            language,
          }),
        {
          summary: () => ({ replyKind: "clarify" }),
          payload: (content) => ({ content }),
        },
      );
    } else {
      const mutation = await runMutationFlow({
        workspaceId,
        scope,
        planner,
        language,
        cleanedMessage: mutationMessage,
        userId: input.userId,
        recentChat: input.recentChat,
        workspaceTimezone: tz,
        activePlan,
        deps: input.deps,
        report,
        runSpan: (agent, fn, opts) => runSpan(trace, agent, fn, opts),
      });
      aiContent = mutation.aiContent;
      pendingId = mutation.pendingId;
    }
  } else {
    aiContent = await runSpan(
      trace,
      "communication",
      () => aiContent,
      {
        summary: () => ({ replyKind: "help" }),
        payload: (content) => ({ content }),
      },
    );
  }

  await report({ step: "complete", status: "done" });
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
