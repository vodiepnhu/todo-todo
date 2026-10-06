import { describe, expect, it } from "vitest";
import { fetchAgentOpsStats } from "@/services/langsmith-stats-service";

describe("fetchAgentOpsStats", () => {
  it("aggregates injected runs", async () => {
    const stats = await fetchAgentOpsStats("7d", {
      listRuns: async () => [
        {
          id: "1",
          name: "agent",
          error: null,
          startTime: new Date(),
          endTime: new Date(),
          totalMs: 500,
          extra: {
            metadata: {
              provider: "openrouter",
              model: "m",
              ok: true,
              cost_usd: 0.02,
              cost_source: "provider",
              span_fails: {},
            },
          },
        },
      ],
      config: { apiKey: "x", project: "stuart-ai" },
    });
    expect(stats.observe.cost.totalUsd).toBeCloseTo(0.02);
    expect(stats.observe.cost.byProvider[0]?.provider).toBe("openrouter");
  });
});
