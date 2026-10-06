import { RunTree } from "langsmith";
import type {
  AgentRunEndMeta,
  AgentSpanRecord,
} from "../agentops/trace";
import { readLangsmithConfig } from "./config";
import { createLangsmithClient } from "./client";

export type LangsmithBridgeContext = {
  profileId: string;
  workspaceId: string | null;
  scope: "project" | "cross";
  messagePreview: string;
};

export type LangsmithBridge = {
  onSpan: (span: AgentSpanRecord) => Promise<void>;
  onEnd: (meta: AgentRunEndMeta) => Promise<void>;
};

export function accumulateSpanFails(
  spanFails: Record<string, number>,
  span: AgentSpanRecord,
): Record<string, number> {
  if (span.ok) return spanFails;
  return {
    ...spanFails,
    [span.agent]: (spanFails[span.agent] ?? 0) + 1,
  };
}

export function buildRootMetadata(
  ctx: LangsmithBridgeContext,
  meta: AgentRunEndMeta,
  spanFails: Record<string, number>,
): Record<string, unknown> {
  return {
    provider: meta.provider ?? null,
    model: meta.model ?? null,
    cost_usd: meta.costUsd ?? null,
    cost_source: meta.costSource ?? null,
    scope: ctx.scope,
    workspace_id: ctx.workspaceId,
    profile_id: ctx.profileId,
    ok: meta.ok,
    span_fails: spanFails,
    intent: meta.intent ?? null,
  };
}

export function createLangsmithRunBridge(
  ctx: LangsmithBridgeContext,
): LangsmithBridge {
  const cfg = readLangsmithConfig();
  if (!cfg) {
    return {
      onSpan: async () => {},
      onEnd: async () => {},
    };
  }

  const { project } = cfg;
  let spanFails: Record<string, number> = {};
  const client = createLangsmithClient(cfg);
  let root: RunTree | null = null;

  async function ensureRoot() {
    if (root) return root;
    root = new RunTree({
      name: "agent-run",
      run_type: "chain",
      project_name: project,
      client,
      inputs: { message_preview: ctx.messagePreview },
      metadata: {
        profile_id: ctx.profileId,
        workspace_id: ctx.workspaceId,
        scope: ctx.scope,
      },
    });
    await root.postRun();
    return root;
  }

  return {
    async onSpan(span) {
      try {
        spanFails = accumulateSpanFails(spanFails, span);
        const parent = await ensureRoot();
        const child = parent.createChild({
          name: span.agent,
          run_type: "chain",
          inputs: { seq: span.seq },
          outputs: { summary: span.summary },
          error: span.ok ? undefined : (span.error ?? "failed"),
          extra: { metadata: { latency_ms: span.latencyMs, ok: span.ok } },
        });
        await child.postRun();
        await child.end(
          { summary: span.summary },
          span.ok ? undefined : (span.error ?? "failed"),
        );
        await child.patchRun();
      } catch (e) {
        console.warn(
          "[langsmith] onSpan failed:",
          e instanceof Error ? e.message : e,
        );
      }
    },
    async onEnd(meta) {
      try {
        const parent = await ensureRoot();
        const metadata = buildRootMetadata(ctx, meta, spanFails);
        parent.extra = {
          ...(parent.extra ?? {}),
          metadata: {
            ...((parent.extra?.metadata as Record<string, unknown>) ?? {}),
            ...metadata,
          },
        };
        await parent.end(
          {
            ok: meta.ok,
            intent: meta.intent ?? null,
            error: meta.error ?? null,
            ...(typeof meta.costUsd === "number"
              ? { usage_metadata: { total_cost: meta.costUsd } }
              : {}),
          },
          meta.ok ? undefined : (meta.error ?? "failed"),
          undefined,
          metadata,
        );
        await parent.patchRun();
        if (typeof client.awaitPendingTraceBatches === "function") {
          await client.awaitPendingTraceBatches();
        }
      } catch (e) {
        console.warn(
          "[langsmith] onEnd failed:",
          e instanceof Error ? e.message : e,
        );
      }
    },
  };
}
