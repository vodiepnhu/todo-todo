import type { LlmProvider } from "./providers";

export type ThinkingMode = "auto" | "off" | "on" | "low" | "medium" | "high";

export type ThinkingOption = {
  value: ThinkingMode;
  label: string;
};

const AUTO: ThinkingOption = { value: "auto", label: "Auto" };
const OFF: ThinkingOption = { value: "off", label: "Off" };
const ON: ThinkingOption = { value: "on", label: "On" };

export function thinkingOptionsForProvider(
  provider: LlmProvider,
): ThinkingOption[] {
  switch (provider) {
    case "ollama":
    case "anthropic":
    case "gemini":
      return [AUTO, OFF, ON];
    case "openrouter":
      return [AUTO, OFF, { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }];
    case "openai":
    case "nvidia":
    case "shopaikey":
      return [AUTO, { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }];
    case "custom":
    default:
      return [AUTO];
  }
}

export function normalizeThinkingMode(value: unknown): ThinkingMode {
  return value === "off" || value === "on" || value === "low" || value === "medium" || value === "high"
    ? value
    : "auto";
}

export function buildThinkingPayload(
  provider: LlmProvider,
  mode: ThinkingMode,
): Record<string, unknown> {
  if (mode === "auto") return {};

  switch (provider) {
    case "ollama":
      return mode === "on" || mode === "off" ? { think: mode === "on" } : {};
    case "openrouter":
      return mode === "off"
        ? { reasoning: { exclude: true } }
        : { reasoning: { effort: mode } };
    case "openai":
    case "nvidia":
    case "shopaikey":
      return mode === "low" || mode === "medium" || mode === "high"
        ? { reasoning_effort: mode }
        : {};
    case "anthropic":
      return mode === "on"
        ? { thinking: { type: "enabled", budget_tokens: 2048 } }
        : {};
    case "gemini":
      return mode === "off"
        ? { thinkingConfig: { thinkingBudget: 0 } }
        : mode === "on"
          ? { thinkingConfig: { thinkingBudget: 2048 } }
          : {};
    case "custom":
    default:
      return {};
  }
}
