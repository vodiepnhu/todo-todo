export type AgentName =
  | "ingest"
  | "policy"
  | "places"
  | "guardrail"
  | "mutation"
  | "rag"
  | "communication";

export type SpanSummary = Record<string, unknown>;

export type AgentSpanRecord = {
  seq: number;
  agent: AgentName;
  ok: boolean;
  latencyMs: number;
  error: string | null;
  summary: SpanSummary;
  payload: unknown | null;
};

export type AgentRunEndMeta = {
  intent?: string;
  ok: boolean;
  error?: string;
  totalMs: number;
  pendingId?: string | null;
  model?: string;
  mocked?: boolean;
  provider?: string;
  llmCalls?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUsd?: number | null;
  costSource?: "provider" | "estimate" | "unknown" | null;
};

export type AgentTrace = {
  runId: string;
  includeFullPayload: boolean;
  spans: AgentSpanRecord[];
  runMeta: AgentRunEndMeta | null;
  span<T>(
    agent: AgentName,
    fn: () => Promise<T> | T,
    opts?: {
      summary?: (result: T) => SpanSummary;
      payload?: (result: T) => unknown;
    },
  ): Promise<T>;
  end(meta: AgentRunEndMeta): Promise<void>;
};

export function truncateJson(
  value: unknown,
  maxBytes: number,
): unknown {
  try {
    const raw = JSON.stringify(value);
    if (raw.length <= maxBytes) return value;
    return {
      truncated: true,
      preview: raw.slice(0, Math.max(0, maxBytes - 64)),
    };
  } catch {
    return { truncated: true, preview: "[unserializable]" };
  }
}

type PersistHooks = {
  onSpan?: (span: AgentSpanRecord) => Promise<void>;
  onEnd?: (meta: AgentRunEndMeta) => Promise<void>;
};

export function createMemoryTrace(opts: {
  runId?: string;
  includeFullPayload: boolean;
  onSpan?: PersistHooks["onSpan"];
  onEnd?: PersistHooks["onEnd"];
}): AgentTrace {
  const spans: AgentSpanRecord[] = [];
  let runMeta: AgentRunEndMeta | null = null;
  const runId = opts.runId ?? crypto.randomUUID();

  async function safePersist(
    label: string,
    fn?: () => Promise<void>,
  ): Promise<void> {
    if (!fn) return;
    try {
      await fn();
    } catch (e) {
      console.warn(
        `[agentops] ${label} failed:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  return {
    runId,
    includeFullPayload: opts.includeFullPayload,
    get spans() {
      return spans;
    },
    get runMeta() {
      return runMeta;
    },
    async span(agent, fn, spanOpts) {
      const started = Date.now();
      try {
        const result = await fn();
        const record: AgentSpanRecord = {
          seq: spans.length,
          agent,
          ok: true,
          latencyMs: Date.now() - started,
          error: null,
          summary: spanOpts?.summary?.(result) ?? {},
          payload:
            opts.includeFullPayload && spanOpts?.payload
              ? truncateJson(spanOpts.payload(result), 16_384)
              : null,
        };
        spans.push(record);
        await safePersist("span", async () => {
          if (opts.onSpan) await opts.onSpan(record);
        });
        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : "unknown error";
        const record: AgentSpanRecord = {
          seq: spans.length,
          agent,
          ok: false,
          latencyMs: Date.now() - started,
          error: message,
          summary: {},
          payload: null,
        };
        spans.push(record);
        await safePersist("span", async () => {
          if (opts.onSpan) await opts.onSpan(record);
        });
        throw e;
      }
    },
    async end(meta) {
      runMeta = meta;
      await safePersist("end", async () => {
        if (opts.onEnd) await opts.onEnd(meta);
      });
    },
  };
}

export function resolveIncludeFullPayload(input: {
  nodeEnv?: string;
  workspaceFlag?: boolean;
  profileFlag?: boolean;
  scope: "project" | "cross";
}): boolean {
  if ((input.nodeEnv ?? process.env.NODE_ENV) === "development") return true;
  if (input.scope === "project") return Boolean(input.workspaceFlag);
  return Boolean(input.profileFlag);
}
