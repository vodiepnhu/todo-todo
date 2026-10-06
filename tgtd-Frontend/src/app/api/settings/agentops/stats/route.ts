import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readLangsmithConfig } from "@/lib/langsmith/config";
import { fetchAgentOpsStats } from "@togo-todo/backend";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cfg = readLangsmithConfig();
    if (!cfg) {
      return NextResponse.json(
        {
          error: "Set LANGSMITH_API_KEY and LANGSMITH_PROJECT in env",
          configured: false,
        },
        { status: 503 },
      );
    }

    const { searchParams } = new URL(request.url);
    const window = searchParams.get("window") === "7d" ? "7d" : "30d";
    const stats = await fetchAgentOpsStats(window, { config: cfg });
    return NextResponse.json({
      stats,
      configured: true,
      project: cfg.project,
      langsmithUrl: "https://smith.langchain.com",
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Failed to load Agent Ops stats",
        configured: true,
      },
      { status: 500 },
    );
  }
}
