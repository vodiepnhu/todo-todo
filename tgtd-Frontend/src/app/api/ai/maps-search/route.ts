import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runMapsSearchAgent } from "@togo-todo/agent";

const bodySchema = z.object({
  query: z.string().min(1).max(200),
});

/** Authenticated Maps place → Google Maps URL lookup. */
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
    const result = await runMapsSearchAgent({ query: body.query });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Maps search failed" },
      { status: 400 },
    );
  }
}
