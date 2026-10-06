import { describe, expect, it, vi } from "vitest";
import {
  createMemoryTrace,
  truncateJson,
} from "@/lib/agentops/trace";

describe("truncateJson", () => {
  it("returns value unchanged when under limit", () => {
    expect(truncateJson({ a: 1 }, 100)).toEqual({ a: 1 });
  });

  it("returns truncated marker when over limit", () => {
    const big = { text: "x".repeat(200) };
    const out = truncateJson(big, 50);
    expect(out).toMatchObject({ truncated: true });
    expect(typeof (out as { preview: string }).preview).toBe("string");
  });
});

describe("createMemoryTrace", () => {
  it("records span order, ok, summary, and latency", async () => {
    const trace = createMemoryTrace({ includeFullPayload: false });
    await trace.span("ingest", async () => ({ intent: "HELP" }), {
      summary: (r) => ({ intent: r.intent }),
      payload: (r) => r,
    });
    await trace.span("policy", () => ({ decision: "allow" as const }), {
      summary: (r) => ({ decision: r.decision }),
    });

    expect(trace.spans).toHaveLength(2);
    expect(trace.spans[0]).toMatchObject({
      seq: 0,
      agent: "ingest",
      ok: true,
      summary: { intent: "HELP" },
    });
    expect(trace.spans[0].payload).toBeNull();
    expect(typeof trace.spans[0].latencyMs).toBe("number");
    expect(trace.spans[1].agent).toBe("policy");
  });

  it("stores payload when includeFullPayload is true", async () => {
    const trace = createMemoryTrace({ includeFullPayload: true });
    await trace.span("rag", () => ({ n: 3 }), {
      summary: (r) => ({ candidateCount: r.n }),
      payload: (r) => r,
    });
    expect(trace.spans[0].payload).toEqual({ n: 3 });
  });

  it("marks ok false and rethrows on span error", async () => {
    const trace = createMemoryTrace({ includeFullPayload: false });
    await expect(
      trace.span("mutation", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(trace.spans[0]).toMatchObject({
      agent: "mutation",
      ok: false,
      error: "boom",
    });
  });

  it("end stores run meta", async () => {
    const trace = createMemoryTrace({ includeFullPayload: false });
    await trace.span("ingest", () => ({}));
    await trace.end({
      intent: "HELP",
      ok: true,
      totalMs: 12,
      pendingId: null,
      model: "mock",
      mocked: true,
    });
    expect(trace.runMeta).toMatchObject({
      intent: "HELP",
      ok: true,
      totalMs: 12,
      mocked: true,
    });
  });

  it("persist hooks are called and errors swallowed", async () => {
    const onSpan = vi.fn().mockRejectedValue(new Error("db down"));
    const onEnd = vi.fn().mockRejectedValue(new Error("db down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const trace = createMemoryTrace({
      includeFullPayload: false,
      onSpan,
      onEnd,
    });
    await trace.span("policy", () => ({ decision: "allow" }));
    await trace.end({ ok: true, totalMs: 1 });
    expect(onSpan).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
