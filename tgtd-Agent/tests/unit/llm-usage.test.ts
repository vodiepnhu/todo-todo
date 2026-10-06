import { describe, expect, it } from "vitest";
import {
  aggregateUsages,
  estimateCostUsd,
  finalizeUsageFromApi,
} from "@/lib/ai/llm-usage";

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
});
