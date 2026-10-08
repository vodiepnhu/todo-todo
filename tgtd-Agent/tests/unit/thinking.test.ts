import { describe, expect, it } from "vitest";
import {
  buildThinkingPayload,
  thinkingOptionsForProvider,
} from "@/lib/ai/thinking";

describe("provider thinking settings", () => {
  it("maps Ollama thinking modes to the native think flag", () => {
    expect(buildThinkingPayload("ollama", "off")).toEqual({ think: false });
    expect(buildThinkingPayload("ollama", "on")).toEqual({ think: true });
    expect(buildThinkingPayload("ollama", "auto")).toEqual({});
  });

  it("maps provider-native reasoning controls", () => {
    expect(buildThinkingPayload("openai", "high")).toEqual({
      reasoning_effort: "high",
    });
    expect(buildThinkingPayload("openrouter", "low")).toEqual({
      reasoning: { effort: "low" },
    });
    expect(buildThinkingPayload("anthropic", "on")).toEqual({
      thinking: { type: "enabled", budget_tokens: 2048 },
    });
    expect(buildThinkingPayload("gemini", "off")).toEqual({
      thinkingConfig: { thinkingBudget: 0 },
    });
  });

  it("does not send unsupported thinking fields to custom providers", () => {
    expect(buildThinkingPayload("custom", "on")).toEqual({});
    expect(thinkingOptionsForProvider("custom")).toEqual([
      { value: "auto", label: "Auto" },
    ]);
  });
});
