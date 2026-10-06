import {
  finalizeUsageFromApi,
  recordLlmUsage,
  resolveOpenRouterCost,
  type LlmUsage,
} from "@/lib/ai/llm-usage";

export type LlmProvider =
  | "openrouter"
  | "openai"
  | "anthropic"
  | "gemini"
  | "ollama"
  | "custom"
  | "shopaikey";


export type LlmModelOption = {
  id: string;
  label: string;
  /** free | paid | local */
  tier?: "free" | "paid" | "local";
};

/** Curated model lists shown in Settings. User can still type a custom id. */
export const LLM_MODELS: Record<LlmProvider, LlmModelOption[]> = {
  openrouter: [
    { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B (free)", tier: "free" },
    {
      id: "nvidia/nemotron-3-ultra-550b-a55b:free",
      label: "Nemotron 3 Ultra (free)",
      tier: "free",
    },
    { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B (free)", tier: "free" },
    { id: "qwen/qwen-2.5-72b-instruct:free", label: "Qwen 2.5 72B (free)", tier: "free" },
    { id: "deepseek/deepseek-chat-v3-0324:free", label: "DeepSeek V3 (free)", tier: "free" },
    { id: "openai/gpt-4o-mini", label: "GPT-4o mini (via OpenRouter)", tier: "paid" },
    { id: "openai/gpt-4o", label: "GPT-4o (via OpenRouter)", tier: "paid" },
    { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5 (via OR)", tier: "paid" },
    { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash (via OR)", tier: "paid" },
    { id: "google/gemini-2.5-pro-preview", label: "Gemini 2.5 Pro (via OR)", tier: "paid" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini", tier: "paid" },
    { id: "gpt-4o", label: "GPT-4o", tier: "paid" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini", tier: "paid" },
    { id: "gpt-4.1", label: "GPT-4.1", tier: "paid" },
    { id: "o4-mini", label: "o4-mini", tier: "paid" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", tier: "paid" },
    { id: "claude-opus-4-5", label: "Claude Opus 4.5", tier: "paid" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", tier: "paid" },
    { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku", tier: "paid" },
  ],
  gemini: [
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", tier: "paid" },
    { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", tier: "paid" },
    { id: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash (preview)", tier: "paid" },
    { id: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro (preview)", tier: "paid" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", tier: "paid" },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", tier: "paid" },
  ],
  ollama: [
    { id: "llama3.2", label: "Llama 3.2", tier: "local" },
    { id: "llama3.1", label: "Llama 3.1", tier: "local" },
    { id: "mistral", label: "Mistral", tier: "local" },
    { id: "qwen2.5", label: "Qwen 2.5", tier: "local" },
    { id: "gemma3", label: "Gemma 3", tier: "local" },
    { id: "phi4", label: "Phi-4", tier: "local" },
    { id: "deepseek-r1", label: "DeepSeek R1", tier: "local" },
  ],
  custom: [
    { id: "local-model", label: "local-model (placeholder)", tier: "local" },
  ],
  // OpenAI-compatible gateway — https://shopaikey.com/en/docs/openai-format
  // Pick from list or paste any model id from https://shopaikey.com/en/models
  shopaikey: [
    { id: "gpt-5.2", label: "GPT-5.2", tier: "paid" },
    { id: "gpt-5-mini", label: "GPT-5 mini", tier: "paid" },
    { id: "gpt-4o", label: "GPT-4o", tier: "paid" },
    { id: "gpt-4o-mini", label: "GPT-4o mini", tier: "paid" },
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", tier: "paid" },
    { id: "claude-opus-4-5", label: "Claude Opus 4.5", tier: "paid" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "paid" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "paid" },
    { id: "deepseek-v3.2", label: "DeepSeek V3.2", tier: "paid" },
  ],
};

export const LLM_PROVIDERS: {
  id: LlmProvider;
  label: string;
  defaultModel: string;
  defaultBaseUrl?: string;
  needsKey: boolean;
  hint: string;
}[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "google/gemma-4-31b-it:free",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    needsKey: true,
    hint: "One key for many models (OpenAI-compatible)",
  },
  {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
    needsKey: true,
    hint: "Official OpenAI Chat Completions",
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    defaultModel: "claude-sonnet-4-5",
    needsKey: true,
    hint: "Claude Messages API",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-2.0-flash",
    needsKey: true,
    hint: "Google Generative Language API",
  },
  {
    id: "ollama",
    label: "Local (Ollama)",
    defaultModel: "llama3.2",
    defaultBaseUrl: "http://host.docker.internal:11434",
    needsKey: false,
    hint: "No key needed. Run Ollama on your machine.",
  },
  {
    id: "custom",
    label: "Custom OpenAI-compatible",
    defaultModel: "local-model",
    defaultBaseUrl: "http://localhost:8080/v1",
    needsKey: false,
    hint: "Any OpenAI-compatible endpoint (LM Studio, vLLM, …)",
  },
  {
    id: "shopaikey",
    label: "ShopAIKey",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.shopaikey.com/v1",
    needsKey: true,
    hint: "OpenAI-compatible gateway (api.shopaikey.com). Select a model or paste any id from their catalog.",
  },
];

export function modelsForProvider(provider: LlmProvider): LlmModelOption[] {
  return LLM_MODELS[provider] ?? [];
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type LlmCallConfig = {
  provider: LlmProvider;
  model: string;
  apiKey: string | null;
  baseUrl: string | null;
};

export async function chatCompletionJson(
  config: LlmCallConfig,
  messages: ChatMessage[],
): Promise<{ content: string; model: string; usage: LlmUsage | null }> {
  let result: { content: string; model: string; usage: LlmUsage | null };
  switch (config.provider) {
    case "anthropic":
      result = await callAnthropic(config, messages);
      break;
    case "gemini":
      result = await callGemini(config, messages);
      break;
    case "ollama":
      result = await callOllama(config, messages);
      break;
    case "openrouter":
    case "openai":
    case "shopaikey":
    case "custom":
    default:
      result = await callOpenAiCompatible(config, messages);
      break;
  }
  if (result.usage) recordLlmUsage(result.usage);
  return result;
}

async function callOpenAiCompatible(
  config: LlmCallConfig,
  messages: ChatMessage[],
): Promise<{ content: string; model: string; usage: LlmUsage | null }> {
  const base =
    config.baseUrl?.replace(/\/$/, "") ||
    (config.provider === "openai"
      ? "https://api.openai.com/v1"
      : config.provider === "shopaikey"
        ? "https://api.shopaikey.com/v1"
        : "https://openrouter.ai/api/v1");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    headers["X-Title"] = "Shared Planner";
  }
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages,
      response_format: { type: "json_object" },
      ...(config.provider === "openrouter" ? { usage: { include: true } } : {}),
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    throw new Error(`${config.provider} HTTP ${res.status}`);
  }
  const json = await res.json();
  const promptTokens = Number(json.usage?.prompt_tokens ?? 0);
  const completionTokens = Number(json.usage?.completion_tokens ?? 0);
  const totalTokens = Number(
    json.usage?.total_tokens ?? promptTokens + completionTokens,
  );
  let providerCost: number | null =
    typeof json.usage?.cost === "number" ? json.usage.cost : null;

  if (config.provider === "openrouter" && providerCost == null) {
    const resolved = await resolveOpenRouterCost({
      apiKey: config.apiKey,
      generationId: typeof json.id === "string" ? json.id : null,
      usageCost: null,
    });
    providerCost = resolved.costUsd;
  }

  const usage =
    promptTokens || completionTokens || providerCost != null
      ? finalizeUsageFromApi({
          provider: config.provider,
          model: config.model,
          promptTokens,
          completionTokens,
          totalTokens,
          providerCostUsd: providerCost,
        })
      : null;

  return {
    content: json.choices?.[0]?.message?.content ?? "{}",
    model: config.model,
    usage,
  };
}

async function callAnthropic(
  config: LlmCallConfig,
  messages: ChatMessage[],
): Promise<{ content: string; model: string; usage: LlmUsage | null }> {
  if (!config.apiKey) throw new Error("Anthropic API key required");
  const system = messages.find((m) => m.role === "system")?.content;
  const rest = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2048,
      system,
      messages: rest,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
  const json = await res.json();
  const content =
    json.content?.map((c: { text?: string }) => c.text ?? "").join("") || "{}";
  const promptTokens = Number(json.usage?.input_tokens ?? 0);
  const completionTokens = Number(json.usage?.output_tokens ?? 0);
  const usage =
    promptTokens || completionTokens
      ? finalizeUsageFromApi({
          provider: config.provider,
          model: config.model,
          promptTokens,
          completionTokens,
        })
      : null;
  return { content, model: config.model, usage };
}

async function callGemini(
  config: LlmCallConfig,
  messages: ChatMessage[],
): Promise<{ content: string; model: string; usage: LlmUsage | null }> {
  if (!config.apiKey) throw new Error("Gemini API key required");
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const userParts = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: userParts }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const json = await res.json();
  const content =
    json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ||
    "{}";
  const promptTokens = Number(json.usageMetadata?.promptTokenCount ?? 0);
  const completionTokens = Number(
    json.usageMetadata?.candidatesTokenCount ?? 0,
  );
  const totalTokens = Number(
    json.usageMetadata?.totalTokenCount ?? promptTokens + completionTokens,
  );
  const usage =
    promptTokens || completionTokens
      ? finalizeUsageFromApi({
          provider: config.provider,
          model: config.model,
          promptTokens,
          completionTokens,
          totalTokens,
        })
      : null;
  return { content, model: config.model, usage };
}

async function callOllama(
  config: LlmCallConfig,
  messages: ChatMessage[],
): Promise<{ content: string; model: string; usage: LlmUsage | null }> {
  const base = (config.baseUrl || "http://127.0.0.1:11434").replace(/\/$/, "");
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      format: "json",
      messages,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const json = await res.json();
  const promptTokens = Number(json.prompt_eval_count ?? 0);
  const completionTokens = Number(json.eval_count ?? 0);
  const usage =
    promptTokens || completionTokens
      ? finalizeUsageFromApi({
          provider: config.provider,
          model: config.model,
          promptTokens,
          completionTokens,
          providerCostUsd: 0,
        })
      : null;
  // Local: cost 0 from "provider" (free)
  if (usage) {
    usage.costUsd = 0;
    usage.costSource = "provider";
  }
  return {
    content: json.message?.content ?? "{}",
    model: config.model,
    usage,
  };
}
