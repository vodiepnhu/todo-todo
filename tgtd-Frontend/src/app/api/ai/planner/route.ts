import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runIngestAgent, runPlannerOrchestrator } from "@togo-todo/agent";
import { createPendingAction } from "@togo-todo/backend";
import { listItems, listWorkspaces } from "@togo-todo/backend";
import { hybridRetrieveItemHits } from "@togo-todo/ai-rag";
import { listRecentChatContext } from "@togo-todo/backend";
import {
  extractGoogleMapsUrl,
  safeMapsRedirect,
  searchPlace,
} from "@togo-todo/agent";
import { recordAgentEvent } from "@togo-todo/agent";
import { createDbAgentTrace } from "@togo-todo/backend";
import { detectChatScope } from "@/lib/chat-scope";
import { runWithLlmUsage, type LlmUsageTotals } from "@togo-todo/agent";

function usageEndFields(t: LlmUsageTotals) {
  return {
    llmCalls: t.llmCalls,
    promptTokens: t.promptTokens,
    completionTokens: t.completionTokens,
    totalTokens: t.totalTokens,
    costUsd: t.costUsd,
    costSource: t.costSource,
  };
}

export async function POST(request: Request) {
  const started = Date.now();
  let workspaceIdForLog: string | undefined;
  try {
    const body = await request.json();
    const { workspaceId, message, askPlanner } = body as {
      workspaceId: string;
      message: string;
      askPlanner?: boolean;
    };
    workspaceIdForLog = workspaceId;
    if (!workspaceId || !message?.trim()) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: membership, error: memErr } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (memErr) {
      return NextResponse.json({ error: memErr.message }, { status: 500 });
    }
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isPlanner =
      askPlanner ||
      /@planner\b/i.test(message) ||
      message.trim().startsWith("@");

    const { data: userMsg, error: userInsertErr } = await supabase
      .from("workspace_messages")
      .insert({
        workspace_id: workspaceId,
        sender_profile_id: user.id,
        message_type: "USER",
        content: message,
      })
      .select("*")
      .single();
    if (userInsertErr) {
      return NextResponse.json(
        { error: `Could not save message: ${userInsertErr.message}` },
        { status: 500 },
      );
    }

    if (!isPlanner) {
      return NextResponse.json({ ok: true, ai: false, message: userMsg });
    }

    const cleaned = message.replace(/@planner/gi, "").trim();
    const scope = detectChatScope({ message: cleaned, route: "project" });
    const memberships = await listWorkspaces(supabase, user.id);
    const memberProjects = memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
    }));
    const memberWorkspaceIds = memberProjects.map((p) => p.id);

    const recentChat = await listRecentChatContext(supabase, workspaceId, {
      excludeMessageId: userMsg.id,
      limit: 20,
    });

    const trace = await createDbAgentTrace(supabase, {
      profileId: user.id,
      workspaceId,
      scope: scope === "cross" ? "cross" : "project",
      message: cleaned,
    });

    let result;
    let usage: LlmUsageTotals = {
      llmCalls: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: null,
      costSource: "unknown",
    };
    try {
      const wrapped = await runWithLlmUsage(() =>
        runPlannerOrchestrator({
          workspaceId,
          scope,
          memberWorkspaceIds,
          memberProjects,
          message: cleaned,
          userId: user.id,
          recentChat: recentChat || undefined,
          trace: trace ?? undefined,
          deps: {
            ingest: runIngestAgent,
            listItems: (ws) => listItems(supabase, ws),
            createPending: (input) => createPendingAction(supabase, input),
            extractMapsUrl: (text) => extractGoogleMapsUrl(text) ?? undefined,
            retrieve: (ids, query) =>
              hybridRetrieveItemHits(supabase, ids, query, {
                includeChat: Boolean(workspaceId),
                recentChat,
                limit: 20,
              }),
            searchPlace,
            safeMapsUrl: safeMapsRedirect,
          },
        }),
      );
      result = wrapped.result;
      usage = wrapped.usage;
      await trace?.end({
        intent: result.planner.intent,
        ok: true,
        totalMs: Date.now() - started,
        pendingId: result.pendingId,
        model: result.model,
        mocked: result.mocked,
        provider: result.provider,
        ...usageEndFields(usage),
      });
    } catch (orchErr) {
      const partial =
        orchErr &&
        typeof orchErr === "object" &&
        "llmUsage" in orchErr
          ? (orchErr as { llmUsage: LlmUsageTotals }).llmUsage
          : usage;
      await trace?.end({
        ok: false,
        error: orchErr instanceof Error ? orchErr.message : "orchestrator failed",
        totalMs: Date.now() - started,
        ...usageEndFields(partial),
      });
      throw orchErr;
    }

    recordAgentEvent({
      event: "planner_orchestrate",
      workspaceId,
      intent: result.planner.intent,
      latencyMs: result.latencyMs,
      totalMs: Date.now() - started,
      mocked: result.mocked,
      ok: true,
      pendingId: result.pendingId,
      meta: { model: result.model, scope },
    });

    const { data: aiMsg, error: aiInsertErr } = await supabase
      .from("workspace_messages")
      .insert({
        workspace_id: workspaceId,
        sender_profile_id: null,
        message_type: "AI",
        content: result.aiContent,
        linked_entity_type: result.pendingId ? "pending_action" : null,
        linked_entity_id: result.pendingId,
      })
      .select("*")
      .single();
    if (aiInsertErr) {
      return NextResponse.json(
        {
          error: `Planner ran but reply was not saved: ${aiInsertErr.message}`,
          pendingId: result.pendingId,
          mocked: result.mocked,
          model: result.model,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      ai: true,
      planner: result.planner,
      pendingId: result.pendingId,
      model: result.model,
      mocked: result.mocked,
      message: userMsg,
      aiMessage: aiMsg,
    });
  } catch (e) {
    console.error(e);
    recordAgentEvent({
      event: "planner_orchestrate",
      workspaceId: workspaceIdForLog,
      ok: false,
      error: e instanceof Error ? e.message : "AI failed",
      totalMs: Date.now() - started,
    });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI failed" },
      { status: 500 },
    );
  }
}
