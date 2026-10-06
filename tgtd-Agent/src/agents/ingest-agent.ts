import { parsePlannerMessage } from "../lib/ai/openrouter";
import type { IngestResult } from "./types";

/** Ingest / NLU agent — structured intent + entities only. Does not write DB. */
export async function runIngestAgent(input: {
  message: string;
  currentDate: string;
  currentDatetime: string;
  workspaceTimezone: string;
  userId: string;
  recentChat?: string;
}): Promise<IngestResult> {
  const { request, model, mocked, latencyMs, provider } =
    await parsePlannerMessage(input);
  return { request, model, mocked, latencyMs, provider };
}
