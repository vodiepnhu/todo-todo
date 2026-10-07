import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runIngestAgent, runPlannerOrchestrator } from "@togo-todo/agent";
import {
  advanceConfirmation,
  createPendingAction,
  isConfirmationKeyword,
  formatConfirmationReply,
  findActivePlanPending,
  listItems,
  listRecentChatContext,
  listWorkspaces,
  updatePendingPlan,
} from "@togo-todo/backend";
import { hybridRetrieveItemHits } from "@togo-todo/ai-rag";
import {
  insertHomeMessage,
  listRecentHomeMessages,
} from "@togo-todo/backend";
import {
  extractGoogleMapsUrl,
  safeMapsRedirect,
  searchPlace,
} from "@togo-todo/agent";
import { recordAgentEvent } from "@togo-todo/agent";
import { createDbAgentTrace } from "@togo-todo/backend";
import {
  DEFAULT_LLM_USAGE_LIMITS,
  runWithLlmUsage,
  type LlmUsageTotals,
} from "@togo-todo/agent";
import {
  applyHomeModeBias,
  type HomeChatMode,
} from "@/lib/home-chat-mode";
import {
  createPlannerStream,
  type PlannerStreamEvent,
} from "@/lib/chat/planner-stream";

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
      workspaceId?: string;
      stream?: boolean;
    };
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }
    const mode: HomeChatMode = body.mode === "add" ? "add" : "ask";
    const requestedWorkspaceId = body.workspaceId?.trim() || null;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userMessage = await insertHomeMessage(supabase, {
      profileId: user.id,
      content: message,
      messageType: "USER",
    });

    const isPlanner =
      body.askPlanner !== false ||
      /@planner\b/i.test(message) ||
      message.trim().startsWith("@");
    const runHomeRequest = async (emit?: (event: PlannerStreamEvent) => void) => {
      const progress = (step: "context" | "save", status: "active" | "done") =>
        emit?.({ type: "progress", step, status });

      if (isConfirmationKeyword(message.replace(/^@planner\s*/i, ""))) {
        progress("save", "active");
        const memberships = await listWorkspaces(supabase, user.id);
        const workspaceIds = memberships.map((m) => m.workspace.id);
        if (requestedWorkspaceId && !workspaceIds.includes(requestedWorkspaceId)) {
          throw new Error("Forbidden");
        }
        const pendingQuery = supabase
          .from("pending_actions")
          .select("id")
          .eq("initiated_by", user.id)
          .eq("state", "AWAITING_CONFIRM_2")
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1);
        if (requestedWorkspaceId) {
          pendingQuery.eq("workspace_id", requestedWorkspaceId);
        } else {
          pendingQuery.in("workspace_id", workspaceIds);
        }
        const { data: pending, error: pendingError } = await pendingQuery.maybeSingle();
        if (pendingError) throw pendingError;
        if (!pending) throw new Error("No active pending action to confirm.");
        const confirmed = await advanceConfirmation(supabase, pending.id, user.id);
        await insertHomeMessage(supabase, {
          profileId: user.id,
          content: formatConfirmationReply(message.replace(/^@planner\s*/i, "")),
          messageType: "AI",
        });
        progress("save", "done");
        return {
          ok: true,
          ai: true,
          confirmed: true,
          pendingId: pending.id,
          pending: confirmed.pending,
        };
      }

      if (!isPlanner) return { ok: true, ai: false };

      const cleaned = applyHomeModeBias(
        message.replace(/@planner/gi, "").trim(),
        mode,
      );
      progress("context", "active");
      const [memberships, recentChat] = await Promise.all([
        listWorkspaces(supabase, user.id),
        requestedWorkspaceId
          ? listRecentChatContext(supabase, requestedWorkspaceId, { limit: 20 })
          : listRecentHomeMessages(supabase, user.id, 20, userMessage.id).then((rows) =>
              rows.map((m) => `${m.message_type}: ${m.content}`).join("\n"),
            ),
      ]);
      const memberProjects = memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
      }));
      const memberWorkspaceIds = memberProjects.map((p) => p.id);
      if (requestedWorkspaceId && !memberWorkspaceIds.includes(requestedWorkspaceId)) {
        throw new Error("Forbidden");
      }
      const scope = requestedWorkspaceId ? "project" : "cross";
      progress("context", "done");

      const trace = await createDbAgentTrace(supabase, {
        profileId: user.id,
        workspaceId: requestedWorkspaceId,
        scope,
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
            workspaceId: requestedWorkspaceId,
            scope,
            memberWorkspaceIds,
            memberProjects,
            message: cleaned,
            userId: user.id,
            readOnly: mode === "ask" || (mode === "add" && !requestedWorkspaceId),
            addRequiresProject: mode === "add" && !requestedWorkspaceId,
            trace: trace ?? undefined,
            onProgress: (event) => emit?.({ type: "progress", ...event }),
            deps: {
              ingest: runIngestAgent,
              listItems: (ws) => listItems(supabase, ws),
              createPending: (input) => createPendingAction(supabase, input),
              findActivePlanPending: (ws, uid) =>
                findActivePlanPending(supabase, ws, uid),
              updatePendingPlan: (pendingId, ws, uid, payload) =>
                updatePendingPlan(supabase, pendingId, ws, uid, payload),
              extractMapsUrl: (text) => extractGoogleMapsUrl(text) ?? undefined,
              retrieve: (ids, query) =>
                hybridRetrieveItemHits(supabase, ids, query, {
                  includeChat: Boolean(requestedWorkspaceId),
                  recentChat,
                  limit: 20,
                }),
              searchPlace,
              safeMapsUrl: safeMapsRedirect,
            },
            recentChat,
          }),
          DEFAULT_LLM_USAGE_LIMITS,
        );
        result = wrapped.result;
        usage = wrapped.usage;
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
        meta: { model: result.model, scope, mode },
      });

      await insertHomeMessage(supabase, {
        profileId: user.id,
        content: result.aiContent,
        messageType: "AI",
        linkedEntityType: result.pendingId ? "pending_action" : undefined,
        linkedEntityId: result.pendingId ?? undefined,
      });
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

      return {
        ok: true,
        content: result.aiContent,
        pendingId: result.pendingId,
        model: result.model,
        mocked: result.mocked,
      };
    };

    if (body.stream) {
      return createPlannerStream(async (emit) => {
        try {
          return await runHomeRequest(emit);
        } catch (error) {
          throw error;
        }
      });
    }

    return NextResponse.json(await runHomeRequest());
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Home chat failed" },
      { status: 500 },
    );
  }
}
