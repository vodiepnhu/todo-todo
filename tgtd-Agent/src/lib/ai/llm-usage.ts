import { AsyncLocalStorage } from "node:async_hooks";

export type CostSource = "provider" | "estimate" | "unknown";

export type LlmUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null;
  costSource: CostSource;
  model: string;
  provider: string;
};

export type LlmUsageTotals = {
  llmCalls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null;
  costSource: CostSource;
};

type UsageStore = {
  calls: LlmUsage[];
  maxCalls?: number;
  maxTotalTokens?: number;
  maxCostUsd?: number;
};

export type LlmUsageLimits = Pick<
  UsageStore,
  "maxCalls" | "maxTotalTokens" | "maxCostUsd"
>;

export const DEFAULT_LLM_USAGE_LIMITS: LlmUsageLimits = {
  maxCalls: 4,
  maxTotalTokens: 16_000,
  maxCostUsd: 0.5,
};

const usageStore = new AsyncLocalStorage<UsageStore>();

export class LlmBudgetExceededError extends Error {
  constructor(message = "LLM call budget exceeded") {
    super(message);
    this.name = "LlmBudgetExceededError";
  }
}

export function recordLlmUsage(usage: LlmUsage): void {
  const store = usageStore.getStore();
  if (!store) return;
  store.calls.push(usage);
  if (store.maxCalls != null && store.calls.length > store.maxCalls) {
    throw new LlmBudgetExceededError();
  }
  if (
    store.maxTotalTokens != null &&
    store.calls.reduce((sum, call) => sum + call.totalTokens, 0) >
      store.maxTotalTokens
  ) {
    throw new LlmBudgetExceededError("LLM token budget exceeded");
  }
  if (
    store.maxCostUsd != null &&
    store.calls.every((call) => call.costUsd != null) &&
    store.calls.reduce((sum, call) => sum + (call.costUsd ?? 0), 0) >
      store.maxCostUsd
  ) {
    throw new LlmBudgetExceededError("LLM cost budget exceeded");
  }
}

export async function runWithLlmUsageStore<T>(
  fn: () => Promise<T>,
  limits: LlmUsageLimits = {},
): Promise<{ result: T; usage: LlmUsageTotals }> {
  return usageStore.run({ calls: [], ...limits }, async () => {
    try {
      const result = await fn();
      return { result, usage: aggregateUsages(usageStore.getStore()?.calls ?? []) };
    } catch (e) {
      const usage = aggregateUsages(usageStore.getStore()?.calls ?? []);
      if (e && typeof e === "object") {
        (e as { llmUsage?: LlmUsageTotals }).llmUsage = usage;
      }
      throw e;
    }
  });
}

/** USD per 1M tokens — rough public list prices for estimate fallback. */
const ESTIMATE_PER_M: Record<
  string,
  { prompt: number; completion: number }
> = {
  "gpt-4o-mini": { prompt: 0.15, completion: 0.6 },
  "openai/gpt-4o-mini": { prompt: 0.15, completion: 0.6 },
  "gpt-4o": { prompt: 2.5, completion: 10 },
  "openai/gpt-4o": { prompt: 2.5, completion: 10 },
  "gpt-4.1-mini": { prompt: 0.4, completion: 1.6 },
  "gpt-4.1": { prompt: 2, completion: 8 },
  "o4-mini": { prompt: 1.1, completion: 4.4 },
  "claude-sonnet-4-5": { prompt: 3, completion: 15 },
  "claude-sonnet-4.5": { prompt: 3, completion: 15 },
  "anthropic/claude-sonnet-4.5": { prompt: 3, completion: 15 },
  "claude-haiku-4-5": { prompt: 1, completion: 5 },
  "claude-3-5-haiku-latest": { prompt: 0.8, completion: 4 },
  "claude-opus-4-5": { prompt: 15, completion: 75 },
  "gemini-2.0-flash": { prompt: 0.1, completion: 0.4 },
  "google/gemini-2.0-flash-001": { prompt: 0.1, completion: 0.4 },
  "gemini-2.5-flash": { prompt: 0.15, completion: 0.6 },
  "gemini-2.5-pro": { prompt: 1.25, completion: 10 },
  "google/gemini-2.5-pro-preview": { prompt: 1.25, completion: 10 },
};

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const key = model.toLowerCase();
  let rates: { prompt: number; completion: number } | undefined =
    ESTIMATE_PER_M[key] ?? ESTIMATE_PER_M[model];
  if (!rates) {
    const hit = Object.entries(ESTIMATE_PER_M).find(
      ([k]) => key.includes(k) || k.includes(key),
    );
    rates = hit?.[1];
  }
  if (!rates) return null;
  return (
    (promptTokens / 1_000_000) * rates.prompt +
    (completionTokens / 1_000_000) * rates.completion
  );
}

export function aggregateUsages(calls: LlmUsage[]): LlmUsageTotals {
  if (calls.length === 0) {
    return {
      llmCalls: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: null,
      costSource: "unknown",
    };
  }
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let costSum = 0;
  let hasCost = false;
  let anyProvider = false;
  let anyEstimate = false;
  for (const c of calls) {
    promptTokens += c.promptTokens;
    completionTokens += c.completionTokens;
    totalTokens += c.totalTokens;
    if (c.costUsd != null) {
      costSum += c.costUsd;
      hasCost = true;
      if (c.costSource === "provider") anyProvider = true;
      if (c.costSource === "estimate") anyEstimate = true;
    }
  }
  const costSource: CostSource = !hasCost
    ? "unknown"
    : anyProvider && !anyEstimate
      ? "provider"
      : anyProvider && anyEstimate
        ? "estimate"
        : anyEstimate
          ? "estimate"
          : "unknown";
  return {
    llmCalls: calls.length,
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd: hasCost ? costSum : null,
    costSource: hasCost
      ? anyProvider && anyEstimate
        ? "estimate"
        : costSource
      : "unknown",
  };
}

export async function resolveOpenRouterCost(input: {
  apiKey: string | null;
  generationId: string | null;
  usageCost: number | null;
}): Promise<{ costUsd: number | null; costSource: CostSource }> {
  if (input.usageCost != null && Number.isFinite(input.usageCost)) {
    return { costUsd: input.usageCost, costSource: "provider" };
  }
  if (!input.apiKey || !input.generationId) {
    return { costUsd: null, costSource: "unknown" };
  }
  try {
    const res = await fetch(
      `https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(input.generationId)}`,
      {
        headers: { Authorization: `Bearer ${input.apiKey}` },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) return { costUsd: null, costSource: "unknown" };
    const json = (await res.json()) as {
      data?: { total_cost?: number; usage?: number };
    };
    const cost = json.data?.total_cost ?? json.data?.usage ?? null;
    if (cost != null && Number.isFinite(cost)) {
      return { costUsd: cost, costSource: "provider" };
    }
  } catch {
    /* ignore */
  }
  return { costUsd: null, costSource: "unknown" };
}

export function finalizeUsageFromApi(input: {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  providerCostUsd?: number | null;
}): LlmUsage {
  const totalTokens =
    input.totalTokens ?? input.promptTokens + input.completionTokens;
  const freeModel = /:free\b|\bfree\b/i.test(input.model);
  let costUsd =
    freeModel && (input.providerCostUsd == null || input.providerCostUsd === 0)
      ? 0
      : (input.providerCostUsd ?? null);
  let costSource: CostSource =
    costUsd != null
      ? freeModel || input.providerCostUsd != null
        ? "provider"
        : "unknown"
      : "unknown";
  if (costUsd == null) {
    const est = estimateCostUsd(
      input.model,
      input.promptTokens,
      input.completionTokens,
    );
    if (est != null) {
      costUsd = est;
      costSource = "estimate";
    }
  }
  return {
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    totalTokens,
    costUsd,
    costSource,
    model: input.model,
    provider: input.provider,
  };
}
