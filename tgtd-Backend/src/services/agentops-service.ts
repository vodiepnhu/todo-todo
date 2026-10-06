import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentRun, AgentSpan } from "../types/database";
import {
  createMemoryTrace,
  resolveIncludeFullPayload,
  type AgentRunEndMeta,
  type AgentSpanRecord,
  type AgentTrace,
} from "../lib/agentops/trace";
import { createLangsmithRunBridge } from "../lib/langsmith/emit";

function previewMessage(message: string, max = 200): string {
  const t = message.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export async function fetchFullPayloadFlag(
  supabase: SupabaseClient,
  input: { workspaceId: string | null; profileId: string },
): Promise<{ workspaceFlag: boolean; profileFlag: boolean }> {
  let workspaceFlag = false;
  let profileFlag = false;
  if (input.workspaceId) {
    const { data } = await supabase
      .from("workspaces")
      .select("agentops_full_payload")
      .eq("id", input.workspaceId)
      .maybeSingle();
    workspaceFlag = Boolean(data?.agentops_full_payload);
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("agentops_full_payload")
    .eq("id", input.profileId)
    .maybeSingle();
  profileFlag = Boolean(profile?.agentops_full_payload);
  return { workspaceFlag, profileFlag };
}

export async function startAgentRun(
  supabase: SupabaseClient,
  input: {
    profileId: string;
    workspaceId: string | null;
    scope: "project" | "cross";
    message: string;
  },
): Promise<{ runId: string; includeFullPayload: boolean } | null> {
  try {
    const flags = await fetchFullPayloadFlag(supabase, {
      workspaceId: input.workspaceId,
      profileId: input.profileId,
    });
    const includeFullPayload = resolveIncludeFullPayload({
      scope: input.scope,
      workspaceFlag: flags.workspaceFlag,
      profileFlag: flags.profileFlag,
    });

    const { data, error } = await supabase
      .from("agent_runs")
      .insert({
        profile_id: input.profileId,
        workspace_id: input.workspaceId,
        scope: input.scope,
        message_preview: previewMessage(input.message),
        ok: false,
      })
      .select("id")
      .single();
    if (error || !data) {
      console.warn("[agentops] startAgentRun failed:", error?.message);
      return null;
    }
    return { runId: data.id as string, includeFullPayload };
  } catch (e) {
    console.warn(
      "[agentops] startAgentRun failed:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

export async function insertAgentSpan(
  supabase: SupabaseClient,
  runId: string,
  span: AgentSpanRecord,
): Promise<void> {
  const { error } = await supabase.from("agent_spans").insert({
    run_id: runId,
    seq: span.seq,
    agent: span.agent,
    ok: span.ok,
    latency_ms: span.latencyMs,
    error: span.error,
    summary: span.summary,
    payload: span.payload,
  });
  if (error) throw error;
}

export async function finishAgentRun(
  supabase: SupabaseClient,
  runId: string,
  meta: AgentRunEndMeta,
): Promise<void> {
  const { error } = await supabase
    .from("agent_runs")
    .update({
      intent: meta.intent ?? null,
      ok: meta.ok,
      error: meta.error ?? null,
      total_ms: meta.totalMs,
      pending_id: meta.pendingId ?? null,
      model: meta.model ?? null,
      mocked: meta.mocked ?? false,
      provider: meta.provider ?? null,
      llm_calls: meta.llmCalls ?? 0,
      prompt_tokens: meta.promptTokens ?? 0,
      completion_tokens: meta.completionTokens ?? 0,
      total_tokens: meta.totalTokens ?? 0,
      cost_usd: meta.costUsd ?? null,
      cost_source: meta.costSource ?? null,
    })
    .eq("id", runId);
  if (error) throw error;
}

export async function sumAgentUsage(
  supabase: SupabaseClient,
  input: { profileId: string; since?: string | null },
): Promise<{
  runs: number;
  llmCalls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
}> {
  let q = supabase
    .from("agent_runs")
    .select(
      "llm_calls, prompt_tokens, completion_tokens, total_tokens, cost_usd",
    )
    .eq("profile_id", input.profileId);
  if (input.since) q = q.gte("created_at", input.since);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  let llmCalls = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let costUsd = 0;
  for (const r of rows) {
    llmCalls += Number(r.llm_calls ?? 0);
    promptTokens += Number(r.prompt_tokens ?? 0);
    completionTokens += Number(r.completion_tokens ?? 0);
    totalTokens += Number(r.total_tokens ?? 0);
    costUsd += Number(r.cost_usd ?? 0);
  }
  return {
    runs: rows.length,
    llmCalls,
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd,
  };
}

export async function createDbAgentTrace(
  supabase: SupabaseClient,
  input: {
    profileId: string;
    workspaceId: string | null;
    scope: "project" | "cross";
    message: string;
  },
): Promise<AgentTrace | null> {
  const started = await startAgentRun(supabase, input);
  if (!started) return null;
  const ls = createLangsmithRunBridge({
    profileId: input.profileId,
    workspaceId: input.workspaceId,
    scope: input.scope,
    messagePreview: previewMessage(input.message),
  });
  return createMemoryTrace({
    runId: started.runId,
    includeFullPayload: started.includeFullPayload,
    onSpan: async (span) => {
      await insertAgentSpan(supabase, started.runId, span);
      await ls.onSpan(span);
    },
    onEnd: async (meta) => {
      await finishAgentRun(supabase, started.runId, meta);
      await ls.onEnd(meta);
    },
  });
}

export async function listAgentRuns(
  supabase: SupabaseClient,
  input: {
    workspaceId?: string | null;
    /** When true (and no workspaceId), list all runs for this profile. */
    profileId?: string;
    allForProfile?: boolean;
    limit?: number;
  },
): Promise<AgentRun[]> {
  const limit = input.limit ?? 50;
  let q = supabase
    .from("agent_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (input.workspaceId) {
    q = q.eq("workspace_id", input.workspaceId);
  } else if (input.allForProfile && input.profileId) {
    q = q.eq("profile_id", input.profileId);
  } else {
    q = q.is("workspace_id", null);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AgentRun[];
}

export async function getAgentRun(
  supabase: SupabaseClient,
  runId: string,
): Promise<{ run: AgentRun; spans: AgentSpan[] } | null> {
  const { data: run, error } = await supabase
    .from("agent_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (error) throw error;
  if (!run) return null;
  const { data: spans, error: spanErr } = await supabase
    .from("agent_spans")
    .select("*")
    .eq("run_id", runId)
    .order("seq", { ascending: true });
  if (spanErr) throw spanErr;
  return { run: run as AgentRun, spans: (spans ?? []) as AgentSpan[] };
}

export async function setAgentopsFullPayload(
  supabase: SupabaseClient,
  input: {
    workspaceId?: string | null;
    profileId: string;
    agentopsFullPayload: boolean;
  },
): Promise<void> {
  if (input.workspaceId) {
    const { error } = await supabase
      .from("workspaces")
      .update({ agentops_full_payload: input.agentopsFullPayload })
      .eq("id", input.workspaceId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("profiles")
    .update({ agentops_full_payload: input.agentopsFullPayload })
    .eq("id", input.profileId);
  if (error) throw error;
}

export async function getAgentopsFullPayloadSetting(
  supabase: SupabaseClient,
  input: { workspaceId?: string | null; profileId: string },
): Promise<boolean> {
  if (input.workspaceId) {
    const { data, error } = await supabase
      .from("workspaces")
      .select("agentops_full_payload")
      .eq("id", input.workspaceId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data?.agentops_full_payload);
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("agentops_full_payload")
    .eq("id", input.profileId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.agentops_full_payload);
}
