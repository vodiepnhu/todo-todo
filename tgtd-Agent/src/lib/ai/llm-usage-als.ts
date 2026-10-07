import {
  runWithLlmUsageStore,
  type LlmUsageLimits,
  type LlmUsageTotals,
} from "./llm-usage";

export async function runWithLlmUsage<T>(
  fn: () => Promise<T>,
  limits: LlmUsageLimits = {},
): Promise<{ result: T; usage: LlmUsageTotals }> {
  return runWithLlmUsageStore(fn, limits);
}
