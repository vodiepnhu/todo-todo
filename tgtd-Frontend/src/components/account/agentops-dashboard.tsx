"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AgentOpsStats } from "@/lib/agentops/stats";
import { fmtMs, fmtPct, fmtUsd } from "@/lib/agentops/format";
import { AgentOpsCard } from "@/components/workspace/agentops-card";
import { toast } from "sonner";

type StatsResponse = {
  stats?: AgentOpsStats;
  configured?: boolean;
  project?: string;
  langsmithUrl?: string;
  error?: string;
};

export function AgentOpsDashboard() {
  const [window, setWindow] = useState<"7d" | "30d">("30d");
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [stats, setStats] = useState<AgentOpsStats | null>(null);
  const [project, setProject] = useState<string | null>(null);
  const [langsmithUrl, setLangsmithUrl] = useState("https://smith.langchain.com");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/settings/agentops/stats?window=${encodeURIComponent(window)}`,
      );
      const json = (await res.json().catch(() => ({}))) as StatsResponse;
      if (res.status === 503) {
        setConfigured(false);
        setStats(null);
        setError(json.error ?? "LangSmith not configured");
        return;
      }
      if (!res.ok) {
        setConfigured(json.configured !== false);
        setError(json.error ?? "Failed to load stats");
        toast.error(json.error ?? "Failed to load Agent Ops stats");
        return;
      }
      setConfigured(true);
      setStats(json.stats ?? null);
      setProject(json.project ?? null);
      if (json.langsmithUrl) setLangsmithUrl(json.langsmithUrl);
    } finally {
      setLoading(false);
    }
  }, [window]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Agent Ops</p>
          <p className="text-xs text-muted">
            Observe → Detect → Analyze (LangSmith)
            {project ? ` · ${project}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(["7d", "30d"] as const).map((w) => (
              <button
                key={w}
                type="button"
                className={
                  window === w
                    ? "rounded px-2 py-0.5 text-[11px] font-medium bg-primary-soft text-foreground"
                    : "rounded px-2 py-0.5 text-[11px] text-muted hover:bg-primary-soft/70"
                }
                onClick={() => setWindow(w)}
              >
                {w}
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      </div>

      {!configured ? (
        <Card className="space-y-2 border-amber-200 bg-amber-50/60">
          <p className="text-sm font-medium text-amber-900">LangSmith not configured</p>
          <p className="text-xs text-amber-800">
            Set <code className="rounded bg-surface/80 px-1">LANGSMITH_API_KEY</code> and{" "}
            <code className="rounded bg-surface/80 px-1">LANGSMITH_PROJECT</code> in{" "}
            <code className="rounded bg-surface/80 px-1">.env.local</code>, then restart the
            server.
          </p>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-xs text-muted">Loading stats…</p>
      ) : stats ? (
        <>
          <section className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Observe
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <Card className="space-y-2">
                <p className="text-xs font-medium text-muted">Cost</p>
                <p className="text-2xl font-semibold text-foreground">
                  {fmtUsd(stats.observe.cost.totalUsd)}
                </p>
                <ul className="space-y-1 text-xs text-muted">
                  {stats.observe.cost.byProvider.length === 0 ? (
                    <li className="text-muted">No cost data</li>
                  ) : (
                    stats.observe.cost.byProvider.map((p) => (
                      <li key={p.provider} className="flex justify-between gap-2">
                        <span>{p.provider}</span>
                        <span>
                          {fmtUsd(p.costUsd)} · {p.runs} runs
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </Card>
              <Card className="space-y-2">
                <p className="text-xs font-medium text-muted">Latency</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-[11px] text-muted">avg</p>
                    <p className="font-semibold">{fmtMs(stats.observe.latency.avgMs)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted">p50</p>
                    <p className="font-semibold">{fmtMs(stats.observe.latency.p50Ms)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted">p95</p>
                    <p className="font-semibold">{fmtMs(stats.observe.latency.p95Ms)}</p>
                  </div>
                </div>
              </Card>
              <Card className="space-y-2">
                <p className="text-xs font-medium text-muted">Quality</p>
                <p className="text-2xl font-semibold text-foreground">
                  {fmtPct(stats.observe.quality.successRate)}
                </p>
                <p className="text-xs text-muted">
                  {stats.observe.quality.okRuns}/{stats.observe.quality.runs} ok
                </p>
                <ul className="space-y-1 text-xs text-muted">
                  {stats.observe.quality.failBySpan.slice(0, 5).map((s) => (
                    <li key={s.span} className="flex justify-between gap-2">
                      <span>{s.span}</span>
                      <span>{s.fails} fails</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-muted">
                  Thumbs feedback — phase 2
                </p>
              </Card>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Detect
            </p>
            <Card className="flex flex-wrap gap-2">
              <DetectBadge
                label="Fail rate >20%"
                active={stats.detect.failRateHigh}
                detail={fmtPct(stats.detect.failRate)}
              />
              <DetectBadge
                label="p95 >10s"
                active={stats.detect.p95LatencyHigh}
                detail={fmtMs(stats.detect.p95Ms)}
              />
              <DetectBadge
                label="Cost/run >$0.05"
                active={stats.detect.costPerRunHigh}
                detail={fmtUsd(stats.detect.costPerRun)}
              />
            </Card>
          </section>

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Analyze
              </p>
              <a
                href={langsmithUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline"
              >
                Open in LangSmith
              </a>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Card className="space-y-1">
                <p className="text-xs font-medium text-muted">Top failing spans</p>
                {stats.analyze.topFailingSpans.length === 0 ? (
                  <p className="text-xs text-muted">None</p>
                ) : (
                  stats.analyze.topFailingSpans.map((s) => (
                    <p key={s.span} className="flex justify-between text-xs">
                      <span>{s.span}</span>
                      <span>{s.fails}</span>
                    </p>
                  ))
                )}
              </Card>
              <Card className="space-y-1">
                <p className="text-xs font-medium text-muted">Top costly providers</p>
                {stats.analyze.topCostlyProviders.length === 0 ? (
                  <p className="text-xs text-muted">None</p>
                ) : (
                  stats.analyze.topCostlyProviders.map((p) => (
                    <p key={p.provider} className="flex justify-between text-xs">
                      <span>{p.provider}</span>
                      <span>{fmtUsd(p.costUsd)}</span>
                    </p>
                  ))
                )}
              </Card>
              <Card className="space-y-1">
                <p className="text-xs font-medium text-muted">Top costly models</p>
                {stats.analyze.topCostlyModels.length === 0 ? (
                  <p className="text-xs text-muted">None</p>
                ) : (
                  stats.analyze.topCostlyModels.map((m) => (
                    <p key={m.model} className="flex justify-between text-xs">
                      <span className="truncate">{m.model}</span>
                      <span>{fmtUsd(m.costUsd)}</span>
                    </p>
                  ))
                )}
              </Card>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Improve
            </p>
            <Card>
              <p className="text-sm text-foreground">
                Feedback loop / evals — coming soon
              </p>
            </Card>
          </section>
        </>
      ) : error && configured ? (
        <p className="text-xs text-danger">{error}</p>
      ) : null}

      <section className="space-y-2 border-t border-border pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Local traces
        </p>
        <AgentOpsCard />
      </section>
    </div>
  );
}

function DetectBadge({
  label,
  active,
  detail,
}: {
  label: string;
  active: boolean;
  detail: string;
}) {
  return (
    <span
      className={
        active
          ? "rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800"
          : "rounded-lg border border-border bg-primary-soft/50 px-2.5 py-1.5 text-xs text-muted"
      }
    >
      {active ? "⚠ " : "✓ "}
      {label}
      <span className="ml-1 text-[10px] opacity-70">({detail})</span>
    </span>
  );
}
