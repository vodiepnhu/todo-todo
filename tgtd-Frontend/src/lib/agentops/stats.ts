export type AgentOpsRunRow = {
  provider: string | null;
  model: string | null;
  ok: boolean;
  totalMs: number | null;
  costUsd: number | null;
  costSource: "provider" | "estimate" | "unknown" | null;
  spanFails: Record<string, number>;
};

export type AgentOpsStats = {
  window: "7d" | "30d";
  observe: {
    cost: {
      totalUsd: number;
      byProvider: { provider: string; costUsd: number; runs: number }[];
    };
    latency: {
      avgMs: number | null;
      p50Ms: number | null;
      p95Ms: number | null;
    };
    quality: {
      runs: number;
      okRuns: number;
      successRate: number | null;
      failBySpan: { span: string; fails: number }[];
    };
  };
  detect: {
    failRateHigh: boolean;
    p95LatencyHigh: boolean;
    costPerRunHigh: boolean;
    failRate: number | null;
    p95Ms: number | null;
    costPerRun: number | null;
  };
  analyze: {
    topFailingSpans: { span: string; fails: number }[];
    topCostlyProviders: { provider: string; costUsd: number }[];
    topCostlyModels: { model: string; costUsd: number }[];
  };
};

export const DETECT = {
  failRate: 0.2,
  p95Ms: 10_000,
  costPerRunUsd: 0.05,
} as const;

/** Linear interpolation percentile; `values` should be sorted ascending. */
export function percentile(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const rank = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo]!;
  const w = rank - lo;
  return sortedAsc[lo]! * (1 - w) + sortedAsc[hi]! * w;
}

function topN(
  map: Map<string, number>,
  n: number,
): { key: string; value: number }[] {
  return [...map.entries()]
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

export function buildAgentOpsStats(
  rows: AgentOpsRunRow[],
  window: "7d" | "30d",
): AgentOpsStats {
  const byProviderCost = new Map<string, { costUsd: number; runs: number }>();
  const byModelCost = new Map<string, number>();
  const spanFails = new Map<string, number>();
  const latencies: number[] = [];
  let totalUsd = 0;
  let okRuns = 0;

  for (const row of rows) {
    const provider = row.provider?.trim() || "unknown";
    const cost = row.costUsd ?? 0;
    totalUsd += cost;
    if (row.ok) okRuns += 1;
    if (row.totalMs != null && Number.isFinite(row.totalMs)) {
      latencies.push(row.totalMs);
    }
    const prev = byProviderCost.get(provider) ?? { costUsd: 0, runs: 0 };
    byProviderCost.set(provider, {
      costUsd: prev.costUsd + cost,
      runs: prev.runs + 1,
    });
    const model = row.model?.trim() || "unknown";
    byModelCost.set(model, (byModelCost.get(model) ?? 0) + cost);
    for (const [span, n] of Object.entries(row.spanFails)) {
      if (n > 0) spanFails.set(span, (spanFails.get(span) ?? 0) + n);
    }
  }

  latencies.sort((a, b) => a - b);
  const avgMs =
    latencies.length === 0
      ? null
      : latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50Ms = percentile(latencies, 50);
  const p95Ms = percentile(latencies, 95);
  const runs = rows.length;
  const failRate = runs === 0 ? null : (runs - okRuns) / runs;
  const costPerRun = runs === 0 ? null : totalUsd / runs;
  const failBySpan = topN(spanFails, 20).map(({ key, value }) => ({
    span: key,
    fails: value,
  }));

  return {
    window,
    observe: {
      cost: {
        totalUsd,
        byProvider: [...byProviderCost.entries()]
          .map(([provider, v]) => ({
            provider,
            costUsd: v.costUsd,
            runs: v.runs,
          }))
          .sort((a, b) => a.provider.localeCompare(b.provider)),
      },
      latency: { avgMs, p50Ms, p95Ms },
      quality: {
        runs,
        okRuns,
        successRate: runs === 0 ? null : okRuns / runs,
        failBySpan,
      },
    },
    detect: {
      failRateHigh: failRate != null && failRate > DETECT.failRate,
      p95LatencyHigh: p95Ms != null && p95Ms > DETECT.p95Ms,
      costPerRunHigh: costPerRun != null && costPerRun > DETECT.costPerRunUsd,
      failRate,
      p95Ms,
      costPerRun,
    },
    analyze: {
      topFailingSpans: failBySpan.slice(0, 5),
      topCostlyProviders: topN(
        new Map(
          [...byProviderCost.entries()].map(([k, v]) => [k, v.costUsd]),
        ),
        5,
      ).map(({ key, value }) => ({ provider: key, costUsd: value })),
      topCostlyModels: topN(byModelCost, 5).map(({ key, value }) => ({
        model: key,
        costUsd: value,
      })),
    },
  };
}
