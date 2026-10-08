import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  clearLlmApiKey,
  getLlmSettingsPublic,
  LLM_MODELS,
  LLM_PROVIDERS,
  thinkingOptionsForProvider,
  upsertLlmSettings,
  type LlmProvider,
  type ThinkingMode,
} from "@togo-todo/agent";
import { z } from "zod";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const settings = await getLlmSettingsPublic(user.id);
    return NextResponse.json({
      settings,
      providers: LLM_PROVIDERS.map((p) => ({
        id: p.id,
        label: p.label,
        defaultModel: p.defaultModel,
        defaultBaseUrl: p.defaultBaseUrl ?? null,
        needsKey: p.needsKey,
        hint: p.hint,
        thinkingOptions: thinkingOptionsForProvider(p.id),
        models: LLM_MODELS[p.id],
      })),
      modelsByProvider: LLM_MODELS,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

const putSchema = z.object({
  provider: z.enum([
    "openrouter",
    "openai",
    "anthropic",
    "gemini",
    "ollama",
    "custom",
    "shopaikey",
    "nvidia",
  ]),
  model: z.string().min(1).max(200),
  baseUrl: z.string().max(500).nullable().optional(),
  thinkingMode: z.enum(["auto", "off", "on", "low", "medium", "high"]).optional(),
  // empty string / omit = keep existing key
  apiKey: z.string().max(500).nullable().optional(),
  clearApiKey: z.boolean().optional(),
});

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = putSchema.parse(await request.json());
    const settings = await upsertLlmSettings(user.id, {
      provider: body.provider as LlmProvider,
      model: body.model,
      baseUrl: body.baseUrl,
      thinkingMode: body.thinkingMode as ThinkingMode | undefined,
      apiKey: body.apiKey,
      clearApiKey: body.clearApiKey,
    });
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const providerParam = new URL(request.url).searchParams.get("provider");
    const provider = providerParam
      ? z
          .enum([
            "openrouter",
            "openai",
            "anthropic",
            "gemini",
            "ollama",
            "custom",
            "shopaikey",
            "nvidia",
          ])
          .parse(providerParam)
      : undefined;
    const settings = await clearLlmApiKey(user.id, provider);
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
