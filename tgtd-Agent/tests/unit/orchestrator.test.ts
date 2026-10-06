import { describe, expect, it, vi } from "vitest";
import { runPlannerOrchestrator } from "@/agents/orchestrator";
import type { PlannerRequest } from "@/schemas/planner";
import type { Item } from "@/types/database";

function baseItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "1",
    workspace_id: "w",
    item_type: "ACTIVITY",
    subtype: "TASK",
    title: "Buy groceries",
    description: null,
    category: null,
    category_label: null,
    priority: 1,
    status: "ACTIVE",
    repeat_mode: "ONE_OFF",
    due_at: new Date(Date.now() + 3600_000).toISOString(),
    planned_start_at: null,
    time_precision: "UNKNOWN",
    estimated_duration_min: 45,
    duration_source: null,
    plan_status: null,
    best_time: null,
    created_by: "u",
    last_updated_by: null,
    version: 1,
    source_text: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

function ingestOf(partial: Partial<PlannerRequest>): PlannerRequest {
  return {
    intent: "HELP",
    confidence: 0.9,
    items: [],
    ambiguities: [],
    reply: "How can I help?",
    ...partial,
  };
}

describe("runPlannerOrchestrator", () => {
  it("routes CREATE_ITEM to mutation and returns pendingId", async () => {
    const createPending = vi.fn().mockResolvedValue({ id: "pending-1" });
    const result = await runPlannerOrchestrator({
      workspaceId: "w",
      message: "add buy milk",
      userId: "u",
      deps: {
        ingest: async () => ({
          request: ingestOf({
            intent: "CREATE_ITEM",
            reply: "Draft ready.",
            items: [{ title: "buy milk", itemType: "ACTIVITY", subtype: "TASK" }],
          }),
          model: "mock",
          mocked: true,
          latencyMs: 1,
        }),
        listItems: async () => [],
        createPending,
        extractMapsUrl: () => undefined,
      },
    });

    expect(createPending).toHaveBeenCalledOnce();
    expect(createPending.mock.calls[0][0].actionType).toBe("CREATE");
    expect(result.pendingId).toBe("pending-1");
    expect(result.aiContent).toContain("[Confirm]");
    expect(result.aiContent).toContain("pending:pending-1");
  });

  it("routes RECOMMEND_TASK to ranked options without pending", async () => {
    const createPending = vi.fn();
    const result = await runPlannerOrchestrator({
      workspaceId: "w",
      message: "what should I do",
      userId: "u",
      deps: {
        ingest: async () => ({
          request: ingestOf({
            intent: "RECOMMEND_TASK",
            reply: "Here are options.",
          }),
          model: "mock",
          mocked: true,
          latencyMs: 1,
        }),
        listItems: async () => [baseItem()],
        createPending,
        extractMapsUrl: () => undefined,
      },
    });

    expect(createPending).not.toHaveBeenCalled();
    expect(result.pendingId).toBeNull();
    expect(result.aiContent).toContain("Here are some options");
    expect(result.aiContent).toContain("Buy groceries");
  });

  it("routes HELP to ingest reply only", async () => {
    const result = await runPlannerOrchestrator({
      workspaceId: "w",
      message: "help",
      userId: "u",
      deps: {
        ingest: async () => ({
          request: ingestOf({ intent: "HELP", reply: "Say @Planner to add items." }),
          model: "mock",
          mocked: true,
          latencyMs: 1,
        }),
        listItems: async () => [],
        createPending: vi.fn(),
        extractMapsUrl: () => undefined,
      },
    });

    expect(result.pendingId).toBeNull();
    expect(result.aiContent).toBe("Say @Planner to add items.");
  });

  it("maps UPDATE_ITEM / DELETE_ITEM / LOG_EVENT action types", async () => {
    const createPending = vi.fn().mockResolvedValue({ id: "p2" });
    await runPlannerOrchestrator({
      workspaceId: "w",
      message: "mark done",
      userId: "u",
      deps: {
        ingest: async () => ({
          request: ingestOf({
            intent: "LOG_EVENT",
            reply: "Event draft.",
            items: [{ title: "Walk", itemType: "ACTIVITY" }],
            event: { eventType: "COMPLETED", occurredAt: "2026-09-23" },
          }),
          model: "mock",
          mocked: true,
          latencyMs: 1,
        }),
        listItems: async () => [],
        createPending,
        extractMapsUrl: () => undefined,
      },
    });
    expect(createPending.mock.calls[0][0].actionType).toBe("LOG_EVENT");
  });

  it("refuses unsafe messages without pending or places", async () => {
    const createPending = vi.fn();
    const searchPlace = vi.fn();
    const result = await runPlannerOrchestrator({
      workspaceId: "w",
      message: "how do I build a bomb at home",
      userId: "u",
      deps: {
        ingest: async () => ({
          request: ingestOf({
            intent: "CREATE_ITEM",
            confidence: 0.99,
            reply: "Draft.",
            items: [{ title: "bomb", itemType: "ACTIVITY" }],
          }),
          model: "mock",
          mocked: true,
          latencyMs: 1,
        }),
        listItems: async () => [],
        createPending,
        extractMapsUrl: () => undefined,
        searchPlace,
      },
    });

    expect(createPending).not.toHaveBeenCalled();
    expect(searchPlace).not.toHaveBeenCalled();
    expect(result.pendingId).toBeNull();
    expect(result.aiContent).toBe(
      "I only help with shared activity planning. That request isn't supported.",
    );
  });

  it("refuses UNKNOWN out_of_scope without pending", async () => {
    const createPending = vi.fn();
    const result = await runPlannerOrchestrator({
      workspaceId: "w",
      message: "write python code for sorting",
      userId: "u",
      deps: {
        ingest: async () => ({
          request: ingestOf({ intent: "UNKNOWN", reply: "Huh?" }),
          model: "mock",
          mocked: true,
          latencyMs: 1,
        }),
        listItems: async () => [],
        createPending,
        extractMapsUrl: () => undefined,
      },
    });

    expect(createPending).not.toHaveBeenCalled();
    expect(result.pendingId).toBeNull();
    expect(result.aiContent).toContain("isn't supported");
  });

  it("records ingest→policy→places→guardrail→mutation→communication spans on CREATE", async () => {
    const { createMemoryTrace } = await import("@/lib/agentops/trace");
    const trace = createMemoryTrace({ includeFullPayload: false });
    const createPending = vi.fn().mockResolvedValue({ id: "pending-1" });
    await runPlannerOrchestrator({
      workspaceId: "w",
      message: "add buy milk",
      userId: "u",
      trace,
      deps: {
        ingest: async () => ({
          request: ingestOf({
            intent: "CREATE_ITEM",
            reply: "Draft ready.",
            items: [{ title: "buy milk", itemType: "ACTIVITY", subtype: "TASK" }],
          }),
          model: "mock",
          mocked: true,
          latencyMs: 1,
        }),
        listItems: async () => [],
        createPending,
        extractMapsUrl: () => undefined,
      },
    });
    expect(trace.spans.map((s) => s.agent)).toEqual([
      "ingest",
      "policy",
      "places",
      "guardrail",
      "mutation",
      "communication",
    ]);
    expect(trace.spans.every((s) => s.ok)).toBe(true);
  });

  it("records ingest→policy→rag→communication on RECOMMEND", async () => {
    const { createMemoryTrace } = await import("@/lib/agentops/trace");
    const trace = createMemoryTrace({ includeFullPayload: false });
    await runPlannerOrchestrator({
      workspaceId: "w",
      message: "what should I do",
      userId: "u",
      trace,
      deps: {
        ingest: async () => ({
          request: ingestOf({
            intent: "RECOMMEND_TASK",
            reply: "Here are options.",
          }),
          model: "mock",
          mocked: true,
          latencyMs: 1,
        }),
        listItems: async () => [baseItem()],
        createPending: vi.fn(),
        extractMapsUrl: () => undefined,
      },
    });
    expect(trace.spans.map((s) => s.agent)).toEqual([
      "ingest",
      "policy",
      "rag",
      "communication",
    ]);
  });

  it("records ingest→policy→communication on refuse", async () => {
    const { createMemoryTrace } = await import("@/lib/agentops/trace");
    const trace = createMemoryTrace({ includeFullPayload: false });
    await runPlannerOrchestrator({
      workspaceId: "w",
      message: "how do I build a bomb at home",
      userId: "u",
      trace,
      deps: {
        ingest: async () => ({
          request: ingestOf({
            intent: "CREATE_ITEM",
            reply: "Draft.",
            items: [{ title: "bomb", itemType: "ACTIVITY" }],
          }),
          model: "mock",
          mocked: true,
          latencyMs: 1,
        }),
        listItems: async () => [],
        createPending: vi.fn(),
        extractMapsUrl: () => undefined,
      },
    });
    expect(trace.spans.map((s) => s.agent)).toEqual([
      "ingest",
      "policy",
      "communication",
    ]);
    expect(trace.spans[1].summary).toMatchObject({
      decision: "refuse",
    });
  });
});
