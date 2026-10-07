import { describe, expect, it } from "vitest";
import {
  aggregateUsages,
  estimateCostUsd,
  finalizeUsageFromApi,
  recordLlmUsage,
} from "@/lib/ai/llm-usage";
import { runWithLlmUsage } from "@/lib/ai/llm-usage-als";

const usage = (provider: string) =>
  finalizeUsageFromApi({
    provider,
    model: "gpt-4o-mini",
    promptTokens: 1,
    completionTokens: 1,
    providerCostUsd: 0.001,
  });

describe("llm-usage", () => {
  it("estimates gpt-4o-mini cost", () => {
    const c = estimateCostUsd("gpt-4o-mini", 1_000_000, 1_000_000);
    expect(c).toBeCloseTo(0.15 + 0.6, 5);
  });

  it("uses provider cost when present", () => {
    const u = finalizeUsageFromApi({
      provider: "openrouter",
      model: "openai/gpt-4o-mini",
      promptTokens: 10,
      completionTokens: 5,
      providerCostUsd: 0.0012,
    });
    expect(u.costUsd).toBe(0.0012);
    expect(u.costSource).toBe("provider");
  });

  it("marks free models as $0 provider", () => {
    const u = finalizeUsageFromApi({
      provider: "openrouter",
      model: "google/gemma-4-31b-it:free",
      promptTokens: 100,
      completionTokens: 50,
    });
    expect(u.costUsd).toBe(0);
    expect(u.costSource).toBe("provider");
  });

  it("aggregates multiple calls", () => {
    const t = aggregateUsages([
      finalizeUsageFromApi({
        provider: "openrouter",
        model: "x:free",
        promptTokens: 10,
        completionTokens: 5,
      }),
      finalizeUsageFromApi({
        provider: "openai",
        model: "gpt-4o-mini",
        promptTokens: 100,
        completionTokens: 20,
        providerCostUsd: 0.01,
      }),
    ]);
    expect(t.llmCalls).toBe(2);
    expect(t.promptTokens).toBe(110);
    expect(t.completionTokens).toBe(25);
    expect(t.costUsd).toBeCloseTo(0.01, 5);
  });

  it("keeps concurrent request usage isolated", async () => {
    const [a, b] = await Promise.all([
      runWithLlmUsage(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        recordLlmUsage(usage("a"));
      }),
      runWithLlmUsage(async () => {
        recordLlmUsage(usage("b"));
        await new Promise((resolve) => setTimeout(resolve, 5));
      }),
    ]);

    expect(a.usage.llmCalls).toBe(1);
    expect(b.usage.llmCalls).toBe(1);
  });

  it("stops request when LLM call budget is exceeded", async () => {
    await expect(
      runWithLlmUsage(
        async () => {
          recordLlmUsage(usage("a"));
          recordLlmUsage(usage("b"));
        },
        { maxCalls: 1 },
      ),
    ).rejects.toThrow("LLM call budget exceeded");
  });
});
