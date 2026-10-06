import type { PlannerRequest } from "../schemas/planner";
import {
  matchesAppHelp,
  matchesOffDomain,
  matchesUnsafe,
} from "../lib/policy/patterns";

const SCOPE_ALLOW = new Set([
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
]);

const LOW_CONFIDENCE = 0.45;

export type PolicyDecision =
  | { decision: "allow" }
  | { decision: "refuse"; reason: "unsafe" | "out_of_scope" };

export function evaluatePolicy(input: {
  message: string;
  planner: Pick<PlannerRequest, "intent" | "confidence" | "reply">;
}): PolicyDecision {
  const message = input.message ?? "";
  const { intent, confidence = 0.5 } = input.planner;

  if (matchesUnsafe(message)) {
    return { decision: "refuse", reason: "unsafe" };
  }

  if (intent === "UNKNOWN") {
    return { decision: "refuse", reason: "out_of_scope" };
  }

  if (intent === "HELP") {
    if (matchesAppHelp(message)) return { decision: "allow" };
    return { decision: "refuse", reason: "out_of_scope" };
  }

  if (
    SCOPE_ALLOW.has(intent) &&
    confidence < LOW_CONFIDENCE &&
    matchesOffDomain(message)
  ) {
    return { decision: "refuse", reason: "out_of_scope" };
  }

  if (SCOPE_ALLOW.has(intent)) {
    return { decision: "allow" };
  }

  return { decision: "refuse", reason: "out_of_scope" };
}
