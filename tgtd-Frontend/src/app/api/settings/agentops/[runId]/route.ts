import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchFullPayloadFlag,
  getAgentRun,
} from "@togo-todo/backend";
import { resolveIncludeFullPayload } from "@togo-todo/agent";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const detail = await getAgentRun(supabase, runId);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const flags = await fetchFullPayloadFlag(supabase, {
      workspaceId: detail.run.workspace_id,
      profileId: user.id,
    });
    const includeFull = resolveIncludeFullPayload({
      scope: detail.run.scope,
      workspaceFlag: flags.workspaceFlag,
      profileFlag: flags.profileFlag,
    });

    const spans = includeFull
      ? detail.spans
      : detail.spans.map((s) => ({ ...s, payload: null }));

    return NextResponse.json({ run: detail.run, spans });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
