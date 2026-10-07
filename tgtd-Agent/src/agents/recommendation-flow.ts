import type { PlannerRequest } from "../schemas/planner";
import type { AgentName, AgentTrace, SpanSummary } from "../lib/agentops/trace";
import {
  formatRecommendReply,
  formatWebSearchConsent,
  formatWebSearchNone,
  formatWebSearchResults,
} from "./communication-agent";
import { runRagAgent } from "./rag-agent";
import { googleMapsPlaceUrl } from "../lib/maps/maps";
import type { OrchestratorDeps, PlannerProgressEvent } from "./types";
import type { Language } from "./language-agent";

export const RECOMMEND_INTENTS = new Set([
  "RECOMMEND_TASK",
  "RECOMMEND_PLACE",
  "RECOMMEND_BOTH",
]);

export const RAG_INTENTS = new Set([
  ...RECOMMEND_INTENTS,
  "LIST_ITEMS",
  "GET_ITEM",
  "LIST_HISTORY",
  "HELP",
]);

export type RecommendationTurn =
  | { kind: "selection"; place: string }
  | { kind: "schedule_confirmed"; place: string }
  | { kind: "schedule_declined" }
  | { kind: "web_search_confirmed"; query: string }
  | { kind: "web_search_declined" }
  | null;

function latestAiMessage(recentChat: string): string {
  const matches = [...recentChat.matchAll(/(?:^|\n)(?:AI|Planner):\s*([\s\S]*?)(?=\n(?:USER|User|AI|Planner):\s*|$)/gi)];
  return matches.at(-1)?.[1]?.trim() ?? "";
}

function recommendationOptions(aiMessage: string): string[] {
  if (!/(?:Here are some options|Đây là một vài lựa chọn)/i.test(aiMessage)) {
    return [];
  }
  return [...aiMessage.matchAll(/(?:^|\s)\d+\.\s+(.+?)(?=\s+\d+\.\s+|$)/g)].map((match) =>
    match[1]
      .split(/\s+—\s+/)[0]
      .split(/\s+·\s+~\d+\s+min/i)[0]
      .replace(/^\[[^\]]+\]\s*/, "")
      .trim(),
  );
}

function schedulePlace(aiMessage: string): string | null {
  const match = aiMessage.match(
    /(?:schedule|lên lịch cho)\s+["“]?([^"”?\n]+)["”]?(?:\s+không)?\?/i,
  );
  return match?.[1]?.trim() || null;
}

function webSearchQuery(aiMessage: string): string | null {
  const match = aiMessage.match(/(?:search online|tìm trên web)[^"“]*["“]([^"”]+)["”]/i);
  return match?.[1]?.trim() || null;
}

function userMessageOnly(message: string): string {
  return message.replace(/\n\s*\(Context:[\s\S]*$/i, "").trim();
}

function isDurationRefinement(message: string, recentChat?: string): boolean {
  if (!recentChat || !recommendationOptions(latestAiMessage(recentChat)).length) return false;
  return /\b(?:under|less\s+than|within|up\s+to|around|about|approximately|\d+\s*(?:hours?|hrs?|h|minutes?|mins?|m))\b/i.test(message);
}

function isYes(message: string): boolean {
  return /^(?:yes|y|yeah|yep|ok(?:ay)?|sure|do it|có|co|đồng ý|muốn)$/i.test(
    userMessageOnly(message).normalize("NFD").replace(/\p{Diacritic}/gu, ""),
  );
}

function isNo(message: string): boolean {
  return /^(?:no|n|nope|nah|không|khong|chưa|chua)$/i.test(
    userMessageOnly(message).normalize("NFD").replace(/\p{Diacritic}/gu, ""),
  );
}

export function resolveRecommendationTurn(input: {
  message: string;
  recentChat?: string;
}): RecommendationTurn {
  const aiMessage = latestAiMessage(input.recentChat ?? "");
  const searchQuery = webSearchQuery(aiMessage);
  if (searchQuery) {
    if (isYes(input.message)) return { kind: "web_search_confirmed", query: searchQuery };
    if (isNo(input.message)) return { kind: "web_search_declined" };
    return null;
  }
  const scheduledPlace = schedulePlace(aiMessage);
  if (scheduledPlace) {
    if (isYes(input.message)) return { kind: "schedule_confirmed", place: scheduledPlace };
    if (isNo(input.message)) return { kind: "schedule_declined" };
    return null;
  }

  const options = recommendationOptions(aiMessage);
  if (!options.length) return null;
  const message = userMessageOnly(input.message).toLowerCase();
  const number = message.match(/^(?:option|choice|pick|chọn)?\s*#?(\d+)$/i);
  const selected = number ? options[Number(number[1]) - 1] : options.find(
    (option) => message === option.toLowerCase() || message.includes(option.toLowerCase()),
  );
  return selected ? { kind: "selection", place: selected } : null;
}

type RunSpan = <T>(
  agent: AgentName,
  fn: () => Promise<T> | T,
  opts?: {
    summary?: (result: T) => SpanSummary;
    payload?: (result: T) => unknown;
  },
) => Promise<T>;

export async function runRecommendationFlow(input: {
  planner: PlannerRequest;
  fallbackContent: string;
  language: Language;
  scope: "project" | "cross";
  workspaceIds: string[];
  memberProjects: Array<{ id: string; name: string }>;
  cleanedMessage: string;
  recentChat?: string;
  deps: Pick<OrchestratorDeps, "listItems" | "retrieve" | "searchPlace">;
  report: (event: PlannerProgressEvent) => Promise<void>;
  runSpan: RunSpan;
}): Promise<{ aiContent: string }> {
  await input.report({ step: "context", status: "active" });
  const rag = await input.runSpan(
    "rag",
    () =>
      runRagAgent({
        intent: input.planner.intent,
        workspaceIds: input.workspaceIds,
        query: input.planner.recommendationQuery || input.cleanedMessage,
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
  await input.report({ step: "context", status: "done" });

  if (input.scope === "cross") {
    for (const c of candidates) {
      if (!projectByItemId.has(c.item.id)) {
        const project = input.memberProjects.find(
          (p) => p.id === c.item.workspace_id,
        );
        if (project) projectByItemId.set(c.item.id, project.name);
      }
    }
  }

  let aiContent: string;
  if (RECOMMEND_INTENTS.has(input.planner.intent) && candidates.length > 0) {
    aiContent = formatRecommendReply({
      intent: input.planner.intent,
      candidates,
      projectByItemId:
        input.scope === "cross" ? projectByItemId : undefined,
      refining: isDurationRefinement(input.cleanedMessage, input.recentChat),
      language: input.language,
    });
  } else if (candidates.length > 0) {
    const visibleCandidates = input.planner.intent === "LIST_ITEMS"
      ? candidates
      : candidates.slice(0, 5);
    const lines = visibleCandidates.map((candidate, index) => {
      const project = projectByItemId.get(candidate.item.id);
      const prefix = project ? `[${project}] ` : "";
      return `${index + 1}. ${prefix}${candidate.item.title}`;
    });
    const chatNote = input.recentChat
      ? "\n(Also considered recent chat — soft-deleted messages excluded.)"
      : "";
    aiContent = `${input.planner.reply || "Here is what I found in your saved data:"}\n\n${lines.join("\n")}${chatNote}`;
  } else if (RECOMMEND_INTENTS.has(input.planner.intent) && input.deps.searchPlace) {
    aiContent = formatWebSearchConsent(
      input.planner.recommendationQuery || input.cleanedMessage,
      input.language,
    );
  } else if (RECOMMEND_INTENTS.has(input.planner.intent)) {
    aiContent = formatRecommendReply({
      intent: input.planner.intent,
      candidates,
      projectByItemId: input.scope === "cross" ? projectByItemId : undefined,
      language: input.language,
    });
  } else {
    aiContent = input.fallbackContent;
  }

  return {
    aiContent: await input.runSpan(
      "communication",
      () => aiContent,
      {
        summary: () => ({ replyKind: "recommend" }),
        payload: (content) => ({ content }),
      },
    ),
  };
}
