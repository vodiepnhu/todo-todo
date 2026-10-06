import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAgentopsFullPayloadSetting,
  listAgentRuns,
  setAgentopsFullPayload,
  sumAgentUsage,
} from "@togo-todo/backend";
import { z } from "zod";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function requireWorkspaceAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("profile_id", userId)
    .maybeSingle();
  return data?.role === "OWNER" || data?.role === "ADMIN";
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (workspaceId) {
      const isAdmin = await requireWorkspaceAdmin(
        supabase,
        workspaceId,
        user.id,
      );
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const [runs, fullPayload] = await Promise.all([
        listAgentRuns(supabase, { workspaceId }),
        getAgentopsFullPayloadSetting(supabase, {
          workspaceId,
          profileId: user.id,
        }),
      ]);
      return NextResponse.json({
        runs,
        agentopsFullPayload: fullPayload,
        scope: "project",
      });
    }

    const [runs, fullPayload, usage7d, usage30d, usageAll] = await Promise.all([
      listAgentRuns(supabase, {
        profileId: user.id,
        allForProfile: true,
      }),
      getAgentopsFullPayloadSetting(supabase, {
        workspaceId: null,
        profileId: user.id,
      }),
      sumAgentUsage(supabase, {
        profileId: user.id,
        since: new Date(Date.now() - 7 * 86_400_000).toISOString(),
      }),
      sumAgentUsage(supabase, {
        profileId: user.id,
        since: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      }),
      sumAgentUsage(supabase, { profileId: user.id }),
    ]);
    return NextResponse.json({
      runs,
      agentopsFullPayload: fullPayload,
      scope: "personal",
      usage: { "7d": usage7d, "30d": usage30d, all: usageAll },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

const patchSchema = z.object({
  workspaceId: z.string().uuid().optional().nullable(),
  agentopsFullPayload: z.boolean(),
});

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = patchSchema.parse(await request.json());
    if (body.workspaceId) {
      const isAdmin = await requireWorkspaceAdmin(
        supabase,
        body.workspaceId,
        user.id,
      );
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    await setAgentopsFullPayload(supabase, {
      workspaceId: body.workspaceId ?? null,
      profileId: user.id,
      agentopsFullPayload: body.agentopsFullPayload,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
