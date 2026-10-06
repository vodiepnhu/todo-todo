import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { clearHomeMessages } from "@togo-todo/backend";

const clearSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }),
  z.object({
    mode: z.literal("day"),
    dayKey: z.string().min(8),
    timeZone: z.string().optional(),
  }),
]);

/** Soft-delete home chat messages for the current user. */
export async function POST(request: Request) {
  try {
    const body = clearSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deleted = await clearHomeMessages(supabase, {
      userId: user.id,
      mode: body.mode,
      dayKey: body.mode === "day" ? body.dayKey : undefined,
      timeZone: body.mode === "day" ? body.timeZone : undefined,
    });
    return NextResponse.json({ deleted });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to clear home chat" },
      { status: 400 },
    );
  }
}
