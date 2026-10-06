import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { advanceConfirmation } from "@togo-todo/backend";

export async function POST(request: Request) {
  try {
    const { pendingId } = await request.json();
    if (!pendingId) {
      return NextResponse.json({ error: "pendingId required" }, { status: 400 });
    }
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await advanceConfirmation(supabase, pendingId, user.id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
