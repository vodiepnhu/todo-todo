import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { acceptInvite } from "@togo-todo/backend";

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const workspaceId = await acceptInvite(supabase, token, user.id);
    return NextResponse.json({ workspaceId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Join failed" },
      { status: 400 },
    );
  }
}
