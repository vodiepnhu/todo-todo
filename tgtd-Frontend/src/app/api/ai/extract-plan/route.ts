import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ExtractBodySchema,
  extractPlanFromChat,
} from "@togo-todo/agent";
import {
  DEFAULT_LLM_USAGE_LIMITS,
  runWithLlmUsage,
  type LlmUsageTotals,
} from "@togo-todo/agent";
import { createDbAgentTrace } from "@togo-todo/backend";

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
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = ExtractBodySchema.parse(await request.json());
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", body.workspaceId)
      .eq("profile_id", user.id)
      .is("archived_at", null)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const trace = await createDbAgentTrace(supabase, {
      profileId: user.id,
      workspaceId: body.workspaceId,
      scope: "project",
      message: body.text,
    });
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
        extractPlanFromChat({
          userId: user.id,
          text: body.text,
          timezone: body.timezone,
          lookupMaps: body.lookupMaps,
        }),
        DEFAULT_LLM_USAGE_LIMITS,
      );
      const result = wrapped.result;
      usage = wrapped.usage;
      await trace?.end({
        intent: "EXTRACT_PLAN",
        ok: true,
        totalMs: Date.now() - started,
        model: result.model,
        mocked: result.mocked,
        provider: result.provider,
        ...usageEndFields(usage),
      });
      return NextResponse.json(result);
    } catch (extractError) {
      const partial =
        extractError &&
        typeof extractError === "object" &&
        "llmUsage" in extractError
          ? (extractError as { llmUsage: LlmUsageTotals }).llmUsage
          : usage;
      await trace?.end({
        intent: "EXTRACT_PLAN",
        ok: false,
        error:
          extractError instanceof Error
            ? extractError.message
            : "extract failed",
        totalMs: Date.now() - started,
        ...usageEndFields(partial),
      });
      throw extractError;
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Extract failed" },
      { status: 400 },
    );
  }
}
