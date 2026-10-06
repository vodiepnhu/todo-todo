import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ExtractBodySchema,
  extractPlanFromChat,
} from "@togo-todo/agent";

export async function POST(request: Request) {
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

    const result = await extractPlanFromChat({
      userId: user.id,
      text: body.text,
      timezone: body.timezone,
      lookupMaps: body.lookupMaps,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Extract failed" },
      { status: 400 },
    );
  }
}
