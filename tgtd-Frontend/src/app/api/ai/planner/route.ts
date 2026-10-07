import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  runIngestAgent,
  runPlannerOrchestrator,
  translateTextToEnglish,
} from "@togo-todo/agent";
import {
  advanceConfirmation,
  createPendingAction,
  findActivePlanPending,
  isConfirmationKeyword,
  formatConfirmationReply,
  updatePendingPlan,
} from "@togo-todo/backend";
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
import { applyHomeModeBias, type HomeChatMode } from "@/lib/home-chat-mode";
import {
  DEFAULT_LLM_USAGE_LIMITS,
  runWithLlmUsage,
  type LlmUsageTotals,
} from "@togo-todo/agent";
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

export async function POST(request: Request) {
  const started = Date.now();
  let workspaceIdForLog: string | undefined;
  try {
    const body = await request.json();
    const { workspaceId, message, askPlanner } = body as {
      workspaceId: string;
      message: string;
      askPlanner?: boolean;
      stream?: boolean;
      mode?: HomeChatMode;
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
      .is("archived_at", null)
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

    const runPlannerRequest = async (emit?: (event: PlannerStreamEvent) => void) => {
      const progress = (step: "context" | "save", status: "active" | "done") =>
        emit?.({ type: "progress", step, status });
      const isConfirmation = isConfirmationKeyword(
        message.replace(/^@planner\s*/i, ""),
      );
      if (isConfirmation) {
        progress("save", "active");
        const { data: pending, error: pendingError } = await supabase
          .from("pending_actions")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("initiated_by", user.id)
          .eq("action_type", "CREATE")
          .eq("payload_json->>schema", "plan")
          .eq("state", "AWAITING_CONFIRM_2")
          .is("before_json", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (pendingError) throw pendingError;
        if (!pending) throw new Error("No active pending action to confirm.");

        const confirmed = await advanceConfirmation(supabase, pending.id, user.id);
        const { data: aiMessage, error: confirmMessageError } = await supabase
          .from("workspace_messages")
          .insert({
            workspace_id: workspaceId,
            sender_profile_id: null,
            message_type: "AI",
            content: formatConfirmationReply(message.replace(/^@planner\s*/i, "")),
            reply_to_message_id: userMsg.id,
            linked_entity_type: "pending_action",
            linked_entity_id: pending.id,
          })
          .select("*")
          .single();
        if (confirmMessageError) throw confirmMessageError;
        progress("save", "done");
        return {
          ok: true,
          ai: true,
          confirmed: true,
          pendingId: pending.id,
          pending: confirmed.pending,
          message: userMsg,
          aiMessage,
        };
      }

      if (!isPlanner) return { ok: true, ai: false, message: userMsg };

      const mode: HomeChatMode = body.mode === "add" ? "add" : "ask";
      const cleaned = applyHomeModeBias(
        message.replace(/@planner/gi, "").trim(),
        mode,
      );
      const scope = detectChatScope({ message: cleaned, route: "project" });
      progress("context", "active");
      const [memberships, recentChat] = await Promise.all([
        scope === "cross" ? listWorkspaces(supabase, user.id) : Promise.resolve([]),
        listRecentChatContext(supabase, workspaceId, {
          excludeMessageId: userMsg.id,
          limit: 20,
        }),
      ]);
      const memberProjects = memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
      }));
      const memberWorkspaceIds = memberProjects.map((p) => p.id);
      progress("context", "done");

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
                  includeChat: Boolean(workspaceId),
                  recentChat,
                  limit: 20,
                  translate: (text) => translateTextToEnglish(user.id, text),
                }),
              searchPlace,
              safeMapsUrl: safeMapsRedirect,
            },
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
          reply_to_message_id: userMsg.id,
          linked_entity_type: result.pendingId ? "pending_action" : null,
          linked_entity_id: result.pendingId,
        })
        .select("*")
        .single();
      if (aiInsertErr) {
        throw new Error(`Planner ran but reply was not saved: ${aiInsertErr.message}`);
      }
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
        ai: true,
        planner: result.planner,
        pendingId: result.pendingId,
        model: result.model,
        mocked: result.mocked,
        message: userMsg,
        aiMessage: aiMsg,
      };
    };

    if (body.stream) {
      return createPlannerStream(async (emit) => {
        try {
          return await runPlannerRequest(emit);
        } catch (error) {
          recordAgentEvent({
            event: "planner_orchestrate",
            workspaceId: workspaceIdForLog,
            ok: false,
            error: error instanceof Error ? error.message : "AI failed",
            totalMs: Date.now() - started,
          });
          throw error;
        }
      });
    }

    return NextResponse.json(await runPlannerRequest());
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
