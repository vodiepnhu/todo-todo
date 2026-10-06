import { Client } from "langsmith";
import type { LangsmithConfig } from "./config";

export type ListedRun = {
  id: string;
  name: string | null;
  error: string | null;
  startTime: Date | null;
  endTime: Date | null;
  totalMs: number | null;
  extra: Record<string, unknown>;
};

export function createLangsmithClient(cfg: LangsmithConfig): Client {
  return new Client({
    apiKey: cfg.apiKey,
    apiUrl: cfg.endpoint,
  });
}

export async function listRootAgentRuns(
  client: Client,
  input: { project: string; since: Date },
): Promise<ListedRun[]> {
  const out: ListedRun[] = [];
  for await (const run of client.listRuns({
    projectName: input.project,
    startTime: input.since,
    isRoot: true,
  })) {
    const start = run.start_time ? new Date(run.start_time) : null;
    const end = run.end_time ? new Date(run.end_time) : null;
    const totalMs =
      start && end ? Math.max(0, end.getTime() - start.getTime()) : null;
    out.push({
      id: String(run.id),
      name: run.name ?? null,
      error: run.error ?? null,
      startTime: start,
      endTime: end,
      totalMs,
      extra: (run.extra as Record<string, unknown> | undefined) ?? {},
    });
  }
  return out;
}
