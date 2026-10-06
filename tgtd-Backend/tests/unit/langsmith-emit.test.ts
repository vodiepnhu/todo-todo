import { describe, expect, it } from "vitest";
import {
  accumulateSpanFails,
  buildRootMetadata,
} from "@/lib/langsmith/emit";
import type { AgentSpanRecord } from "@/lib/agentops/trace";

const span = (over: Partial<AgentSpanRecord>): AgentSpanRecord => ({
  seq: 1,
  agent: "guardrail",
  ok: false,
  latencyMs: 10,
  error: "x",
  summary: {},
  payload: null,
  ...over,
});

describe("langsmith emit helpers", () => {
  it("accumulates span fails", () => {
    let fails = accumulateSpanFails({}, span({ agent: "guardrail" }));
    fails = accumulateSpanFails(fails, span({ agent: "guardrail" }));
    fails = accumulateSpanFails(fails, span({ agent: "places", ok: true }));
    expect(fails).toEqual({ guardrail: 2 });
  });

  it("builds root metadata with provider and span_fails", () => {
    const md = buildRootMetadata(
      {
        profileId: "p1",
        workspaceId: null,
        scope: "cross",
        messagePreview: "hi",
      },
      {
        ok: true,
        totalMs: 100,
        provider: "openrouter",
        model: "m",
        costUsd: 0.02,
        costSource: "provider",
      },
      { guardrail: 1 },
    );
    expect(md.provider).toBe("openrouter");
    expect(md.cost_usd).toBe(0.02);
    expect(md.span_fails).toEqual({ guardrail: 1 });
    expect(md.profile_id).toBe("p1");
  });
});
