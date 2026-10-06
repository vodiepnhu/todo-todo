"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import type { AgentRun, AgentSpan } from "@/types/database";

type UsageBucket = {
  runs: number;
  llmCalls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
};

type ListResponse = {
  runs: AgentRun[];
  agentopsFullPayload: boolean;
  scope: "project" | "cross" | "personal";
  usage?: { "7d": UsageBucket; "30d": UsageBucket; all: UsageBucket };
  error?: string;
};

function fmtUsd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function fmtTokens(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

export function AgentOpsCard({
  workspaceId,
}: {
  workspaceId?: string | null;
}) {
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [fullPayload, setFullPayload] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [spans, setSpans] = useState<AgentSpan[] | null>(null);
  const [usage, setUsage] = useState<ListResponse["usage"] | null>(null);
  const [usageWindow, setUsageWindow] = useState<"7d" | "30d" | "all">("30d");
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = workspaceId
        ? `?workspaceId=${encodeURIComponent(workspaceId)}`
        : "";
      const res = await fetch(`/api/settings/agentops${qs}`);
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as ListResponse;
        toast.error(json.error ?? "Failed to load Agent Ops");
        return;
      }
      const json = (await res.json()) as ListResponse;
      setForbidden(false);
      setRuns(json.runs ?? []);
      setFullPayload(Boolean(json.agentopsFullPayload));
      setUsage(json.usage ?? null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFullPayload(next: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/agentops", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspaceId ?? null,
          agentopsFullPayload: next,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Could not update setting");
        return;
      }
      setFullPayload(next);
      toast.success(
        next ? "Full payloads enabled" : "Full payloads disabled",
      );
    } finally {
      setSaving(false);
    }
  }

  async function openRun(id: string) {
    setSelectedId(id);
    setDetailLoading(true);
    setSpans(null);
    try {
      const res = await fetch(`/api/settings/agentops/${id}`);
      if (!res.ok) {
        toast.error("Could not load run");
        return;
      }
      const json = await res.json();
      setSpans(json.spans ?? []);
    } finally {
      setDetailLoading(false);
    }
  }

  if (forbidden) return null;

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Agent Ops</p>
          <p className="text-xs text-muted">
            {workspaceId
              ? "Per-agent traces for this project (admins)."
              : "Your agent run history (home + projects) — expand a run like History."}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={fullPayload}
          disabled={saving || loading}
          onChange={(e) => void toggleFullPayload(e.target.checked)}
        />
        Store full agent payloads
        <span className="text-xs text-muted">
          (also on in development)
        </span>
      </label>

      {usage && !workspaceId ? (
        <div className="space-y-2 rounded-lg border border-border bg-primary-soft/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Usage
            </p>
            <div className="flex gap-1">
              {(["7d", "30d", "all"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  className={
                    usageWindow === w
                      ? "rounded px-2 py-0.5 text-[11px] font-medium bg-primary-soft text-foreground"
                      : "rounded px-2 py-0.5 text-[11px] text-muted hover:bg-primary-soft/70"
                  }
                  onClick={() => setUsageWindow(w)}
                >
                  {w === "all" ? "All" : w}
                </button>
              ))}
            </div>
          </div>
          {(() => {
            const u = usage[usageWindow];
            return (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
                <div>
                  <p className="text-[11px] text-muted">Runs</p>
                  <p className="font-semibold text-foreground">{u.runs}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted">LLM calls</p>
                  <p className="font-semibold text-foreground">{u.llmCalls}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted">Tokens</p>
                  <p className="font-semibold text-foreground">
                    {fmtTokens(u.totalTokens)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted">Cost</p>
                  <p className="font-semibold text-foreground">
                    {fmtUsd(u.costUsd)}
                  </p>
                </div>
              </div>
            );
          })()}
          <p className="text-[10px] text-muted">
            OpenRouter uses native $; other providers may show estimate.
          </p>
        </div>
      ) : null}

      {loading ? (
        <p className="text-xs text-muted">Loading runs…</p>
      ) : runs.length === 0 ? (
        <p className="text-xs text-muted">No runs yet. Chat with @Planner.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {runs.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-primary-soft/60"
                onClick={() => void openRun(r.id)}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-foreground">
                    {r.scope === "cross" ? "Home" : "Project"} ·{" "}
                    {r.intent ?? "—"} · {r.ok ? "ok" : "fail"}
                  </span>
                  <span className="text-muted">
                    {r.total_ms != null ? `${r.total_ms}ms` : ""} ·{" "}
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="truncate text-[11px] text-muted">
                  {r.message_preview || "(empty)"}
                </p>
                <p className="text-[10px] text-muted">
                  {r.llm_calls ?? 0} calls · {fmtTokens(r.total_tokens)} tok ·{" "}
                  {fmtUsd(r.cost_usd)}
                  {r.cost_source === "estimate"
                    ? " (est.)"
                    : r.cost_source === "provider"
                      ? ""
                      : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedId ? (
        <div className="space-y-2 rounded-lg border border-border bg-primary-soft/50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">
              Spans · {selectedId.slice(0, 8)}…
            </p>
            <button
              type="button"
              className="text-[11px] text-muted underline"
              onClick={() => {
                setSelectedId(null);
                setSpans(null);
              }}
            >
              Close
            </button>
          </div>
          {detailLoading ? (
            <p className="text-xs text-muted">Loading…</p>
          ) : spans && spans.length === 0 ? (
            <p className="text-xs text-muted">No spans recorded.</p>
          ) : (
            <ol className="space-y-2">
              {(spans ?? []).map((s) => (
                <li
                  key={`${s.run_id}-${s.seq}`}
                  className="rounded border border-border bg-surface p-2 text-xs"
                >
                  <div className="flex justify-between gap-2 font-medium">
                    <span>
                      #{s.seq} {s.agent} · {s.ok ? "ok" : "fail"}
                    </span>
                    <span className="text-muted">
                      {s.latency_ms != null ? `${s.latency_ms}ms` : ""}
                    </span>
                  </div>
                  {s.error ? (
                    <p className="mt-1 text-red-600">{s.error}</p>
                  ) : null}
                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[10px] text-muted">
                    {JSON.stringify(s.summary, null, 2)}
                  </pre>
                  {s.payload != null ? (
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-[10px] text-muted">
                      {JSON.stringify(s.payload, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </Card>
  );
}
