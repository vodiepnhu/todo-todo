import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runIngestAgent, runPlannerOrchestrator } from "@togo-todo/agent";
import { createPendingAction } from "@togo-todo/backend";
import { listItems, listWorkspaces } from "@togo-todo/backend";
import { hybridRetrieveItemHits } from "@togo-todo/ai-rag";
import { insertHomeMessage } from "@togo-todo/backend";
import {
  extractGoogleMapsUrl,
  safeMapsRedirect,
  searchPlace,
} from "@togo-todo/agent";
import { recordAgentEvent } from "@togo-todo/agent";
import { createDbAgentTrace } from "@togo-todo/backend";
import { runWithLlmUsage, type LlmUsageTotals } from "@togo-todo/agent";
import {
  applyHomeModeBias,
  type HomeChatMode,
} from "@/lib/home-chat-mode";

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

export async function POST(req: Request) {
  const started = Date.now();
  try {
    const body = (await req.json()) as {
      message?: string;
      askPlanner?: boolean;
      mode?: HomeChatMode;
    };
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }
    const mode: HomeChatMode = body.mode === "add" ? "add" : "ask";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await insertHomeMessage(supabase, {
      profileId: user.id,
      content: message,
      messageType: "USER",
    });

    const isPlanner =
      body.askPlanner !== false ||
      /@planner\b/i.test(message) ||
      message.trim().startsWith("@");

    if (!isPlanner) {
      return NextResponse.json({ ok: true, ai: false });
    }

    const cleaned = applyHomeModeBias(
      message.replace(/@planner/gi, "").trim(),
      mode,
    );
    const memberships = await listWorkspaces(supabase, user.id);
    const memberProjects = memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
    }));
    const memberWorkspaceIds = memberProjects.map((p) => p.id);

    const trace = await createDbAgentTrace(supabase, {
      profileId: user.id,
      workspaceId: null,
      scope: "cross",
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
          workspaceId: null,
          scope: "cross",
          memberWorkspaceIds,
          memberProjects,
          message: cleaned,
          userId: user.id,
          trace: trace ?? undefined,
          deps: {
            ingest: runIngestAgent,
            listItems: (ws) => listItems(supabase, ws),
            createPending: (input) => createPendingAction(supabase, input),
            extractMapsUrl: (text) => extractGoogleMapsUrl(text) ?? undefined,
            retrieve: (ids, query) =>
              hybridRetrieveItemHits(supabase, ids, query, {
                includeChat: false,
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
      event: "home_orchestrate",
      intent: result.planner.intent,
      latencyMs: result.latencyMs,
      totalMs: Date.now() - started,
      mocked: result.mocked,
      ok: true,
      pendingId: result.pendingId,
      meta: { model: result.model, scope: "cross", mode },
    });

    await insertHomeMessage(supabase, {
      profileId: user.id,
      content: result.aiContent,
      messageType: "AI",
      linkedEntityType: result.pendingId ? "pending_action" : undefined,
      linkedEntityId: result.pendingId ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      content: result.aiContent,
      pendingId: result.pendingId,
      model: result.model,
      mocked: result.mocked,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Home chat failed" },
      { status: 500 },
    );
  }
}
