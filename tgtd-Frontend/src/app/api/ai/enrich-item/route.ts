import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { enrichItemDraft } from "@togo-todo/agent";

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  text: z.string().min(1).max(2000),
  timezone: z.string().max(80).optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = bodySchema.parse(await request.json());
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

    const result = await enrichItemDraft({
      userId: user.id,
      text: body.text,
      timezone: body.timezone,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Enrich failed" },
      { status: 400 },
    );
  }
}
