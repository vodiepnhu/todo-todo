import {
  buildAgentOpsStats,
  type AgentOpsRunRow,
  type AgentOpsStats,
} from "../lib/agentops/stats";
import {
  createLangsmithClient,
  listRootAgentRuns,
  type ListedRun,
} from "../lib/langsmith/client";
import {
  readLangsmithConfig,
  type LangsmithConfig,
} from "../lib/langsmith/config";

export function rowFromListedRun(run: ListedRun): AgentOpsRunRow {
  const md =
    (run.extra.metadata as Record<string, unknown> | undefined) ?? run.extra;
  const spanFails =
    (md.span_fails as Record<string, number> | undefined) ?? {};
  const costSource = md.cost_source;
  return {
    provider: typeof md.provider === "string" ? md.provider : null,
    model: typeof md.model === "string" ? md.model : null,
    ok: !run.error && md.ok !== false,
    totalMs: run.totalMs,
    costUsd: typeof md.cost_usd === "number" ? md.cost_usd : null,
    costSource:
      costSource === "provider" ||
      costSource === "estimate" ||
      costSource === "unknown"
        ? costSource
        : null,
    spanFails,
  };
}

export type FetchAgentOpsStatsDeps = {
  listRuns: (input: {
    project: string;
    since: Date;
  }) => Promise<ListedRun[]>;
  config: LangsmithConfig;
};

function sinceForWindow(window: "7d" | "30d"): Date {
  const days = window === "7d" ? 7 : 30;
  return new Date(Date.now() - days * 86_400_000);
}

export async function fetchAgentOpsStats(
  window: "7d" | "30d",
  deps?: Partial<FetchAgentOpsStatsDeps>,
): Promise<AgentOpsStats> {
  const config = deps?.config ?? readLangsmithConfig();
  if (!config) {
    throw new Error("LangSmith is not configured");
  }
  const listRuns =
    deps?.listRuns ??
    ((input: { project: string; since: Date }) =>
      listRootAgentRuns(createLangsmithClient(config), input));

  const runs = await listRuns({
    project: config.project,
    since: sinceForWindow(window),
  });
  return buildAgentOpsStats(runs.map(rowFromListedRun), window);
}
