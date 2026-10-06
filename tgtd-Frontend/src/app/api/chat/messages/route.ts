import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  dayKeyLocal,
  messageIdsForPendingThread,
} from "@/lib/chat/chat-history";
import type { WorkspaceMessage } from "@/types/database";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

async function requireMember(
  workspaceId: string,
): Promise<
  | { supabase: SupabaseClient; userId: string }
  | { error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
      .eq("profile_id", user.id)
      .is("archived_at", null)
    .maybeSingle();
  if (!membership) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { supabase, userId: user.id };
}

/** Same-origin chat history — avoids browser→Kong CORS / Failed to fetch. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }

    const auth = await requireMember(workspaceId);
    if ("error" in auth) return auth.error;

    const { data, error } = await auth.supabase
      .from("workspace_messages")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load chat" },
      { status: 500 },
    );
  }
}

const clearSchema = z.discriminatedUnion("mode", [
  z.object({
    workspaceId: z.string().uuid(),
    mode: z.literal("all"),
  }),
  z.object({
    workspaceId: z.string().uuid(),
    mode: z.literal("day"),
    dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timeZone: z.string().min(1).max(80),
  }),
  z.object({
    workspaceId: z.string().uuid(),
    mode: z.literal("pending"),
    pendingId: z.string().uuid(),
  }),
]);

/** Soft-delete chat messages. Does not delete plans/items. */
export async function POST(request: Request) {
  try {
    const body = clearSchema.parse(await request.json());
    const auth = await requireMember(body.workspaceId);
    if ("error" in auth) return auth.error;

    const { data: rows, error } = await auth.supabase
      .from("workspace_messages")
      .select("*")
      .eq("workspace_id", body.workspaceId)
      .is("deleted_at", null);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const messages = (rows ?? []) as WorkspaceMessage[];

    let ids: string[] = [];
    if (body.mode === "all") {
      ids = messages.map((m) => m.id);
    } else if (body.mode === "day") {
      ids = messages
        .filter((m) => dayKeyLocal(m.created_at, body.timeZone) === body.dayKey)
        .map((m) => m.id);
    } else {
      ids = messageIdsForPendingThread(messages, body.pendingId);
    }

    if (ids.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    const now = new Date().toISOString();
    const { error: updErr } = await auth.supabase
      .from("workspace_messages")
      .update({ deleted_at: now })
      .in("id", ids);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: ids.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to clear chat" },
      { status: 400 },
    );
  }
}
