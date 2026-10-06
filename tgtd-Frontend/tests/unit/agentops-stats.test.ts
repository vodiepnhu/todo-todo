import { describe, expect, it } from "vitest";
import {
  buildAgentOpsStats,
  percentile,
  type AgentOpsRunRow,
} from "@/lib/agentops/stats";

const base = (over: Partial<AgentOpsRunRow>): AgentOpsRunRow => ({
  provider: "openrouter",
  model: "x",
  ok: true,
  totalMs: 1000,
  costUsd: 0.01,
  costSource: "provider",
  spanFails: {},
  ...over,
});

describe("percentile", () => {
  it("p95 on sorted values", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(xs, 50)).toBe(5.5);
    expect(percentile(xs, 95)).toBeGreaterThanOrEqual(9);
  });
});

describe("buildAgentOpsStats", () => {
  it("breaks cost down by provider", () => {
    const stats = buildAgentOpsStats(
      [
        base({ provider: "openrouter", costUsd: 0.02 }),
        base({ provider: "gemini", costUsd: 0.03 }),
        base({ provider: "shopaikey", costUsd: 0.01 }),
      ],
      "7d",
    );
    expect(stats.observe.cost.totalUsd).toBeCloseTo(0.06);
    expect(stats.observe.cost.byProvider.map((p) => p.provider).sort()).toEqual(
      ["gemini", "openrouter", "shopaikey"],
    );
  });

  it("sets detect flags from fixed thresholds", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      base({
        ok: i < 7,
        totalMs: 12_000,
        costUsd: 0.1,
        spanFails: i >= 7 ? { guardrail: 1 } : {},
      }),
    );
    const stats = buildAgentOpsStats(rows, "7d");
    expect(stats.detect.failRateHigh).toBe(true);
    expect(stats.detect.p95LatencyHigh).toBe(true);
    expect(stats.detect.costPerRunHigh).toBe(true);
    expect(stats.analyze.topFailingSpans[0]?.span).toBe("guardrail");
  });
});
