import type { PlannerRequest } from "../../schemas/planner";
import type { OrchestratorResult } from "../../agents/types";

export type AgentEvent = {
  ts: number;
  event: string;
  workspaceId?: string;
  intent?: string;
  latencyMs?: number;
  totalMs?: number;
  mocked?: boolean;
  ok?: boolean;
  error?: string;
  pendingId?: string | null;
  meta?: Record<string, unknown>;
};

export type AgentMetrics = {
  totalEvents: number;
  errors: number;
  byIntent: Record<string, number>;
  avgTotalMs: number;
};

export type GoldenExpect = {
  intent: string;
  hasPending: boolean;
  replyIncludes?: string[];
};

export type GoldenCase = {
  id: string;
  message: string;
  ingest: PlannerRequest;
  expect: GoldenExpect;
};

export type GoldenReport = {
  passed: string[];
  failed: { id: string; reason: string }[];
};

const MAX_EVENTS = 500;
const events: AgentEvent[] = [];

export const agentOps = {
  get events() {
    return events;
  },
};

export function resetAgentOps() {
  events.length = 0;
}

export function recordAgentEvent(
  event: Omit<AgentEvent, "ts"> & { ts?: number },
): AgentEvent {
  const row: AgentEvent = { ts: event.ts ?? Date.now(), ...event };
  events.push(row);
  if (events.length > MAX_EVENTS) events.shift();
  console.info(JSON.stringify({ type: "agentops", ...row }));
  return row;
}

export function getAgentMetrics(): AgentMetrics {
  const byIntent: Record<string, number> = {};
  let errors = 0;
  let totalMsSum = 0;
  let totalMsN = 0;
  for (const e of events) {
    if (e.intent) byIntent[e.intent] = (byIntent[e.intent] ?? 0) + 1;
    if (e.ok === false) errors += 1;
    if (typeof e.totalMs === "number") {
      totalMsSum += e.totalMs;
      totalMsN += 1;
    }
  }
  return {
    totalEvents: events.length,
    errors,
    byIntent,
    avgTotalMs: totalMsN ? totalMsSum / totalMsN : 0,
  };
}

export async function runGoldenEval(
  cases: GoldenCase[],
  run: (c: GoldenCase) => Promise<OrchestratorResult>,
): Promise<GoldenReport> {
  const passed: string[] = [];
  const failed: { id: string; reason: string }[] = [];

  for (const c of cases) {
    try {
      const result = await run(c);
      if (result.planner.intent !== c.expect.intent) {
        failed.push({
          id: c.id,
          reason: `intent ${result.planner.intent} != ${c.expect.intent}`,
        });
        continue;
      }
      const hasPending = Boolean(result.pendingId);
      if (hasPending !== c.expect.hasPending) {
        failed.push({
          id: c.id,
          reason: `hasPending ${hasPending} != ${c.expect.hasPending}`,
        });
        continue;
      }
      let replyOk = true;
      for (const snippet of c.expect.replyIncludes ?? []) {
        if (!result.aiContent.includes(snippet)) {
          failed.push({
            id: c.id,
            reason: `reply missing "${snippet}"`,
          });
          replyOk = false;
          break;
        }
      }
      if (!replyOk) continue;
      passed.push(c.id);
    } catch (e) {
      failed.push({
        id: c.id,
        reason: e instanceof Error ? e.message : "unknown error",
      });
    }
  }

  return { passed, failed };
}
