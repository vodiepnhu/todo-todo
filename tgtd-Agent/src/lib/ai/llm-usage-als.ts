import { AsyncLocalStorage } from "node:async_hooks";
import {
  aggregateUsages,
  bindLlmUsageRecorder,
  type LlmUsage,
  type LlmUsageTotals,
} from "./llm-usage";

type Store = { calls: LlmUsage[] };

const als = new AsyncLocalStorage<Store>();

export async function runWithLlmUsage<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; usage: LlmUsageTotals }> {
  return als.run({ calls: [] }, async () => {
    bindLlmUsageRecorder((usage) => {
      const store = als.getStore();
      store?.calls.push(usage);
    });
    try {
      const result = await fn();
      return { result, usage: aggregateUsages(als.getStore()?.calls ?? []) };
    } catch (e) {
      const usage = aggregateUsages(als.getStore()?.calls ?? []);
      if (e && typeof e === "object") {
        (e as { llmUsage?: LlmUsageTotals }).llmUsage = usage;
      }
      throw e;
    } finally {
      bindLlmUsageRecorder(null);
    }
  });
}
