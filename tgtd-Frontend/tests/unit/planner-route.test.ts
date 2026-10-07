import { beforeEach, describe, expect, it, vi } from "vitest";
import { consumePlannerStream } from "@/lib/chat/planner-stream";

const runPlannerOrchestrator = vi.fn();
const advanceConfirmation = vi.fn();
const findActivePlanPending = vi.fn();
const updatePendingPlan = vi.fn();
const createDbAgentTrace = vi.fn();
const workspaceMessageInserts: Record<string, unknown>[] = [];
const pendingLookupFilters: Array<[string, unknown]> = [];
let pendingLookupResult: { data: Record<string, unknown> | null; error: null } = {
  data: null,
  error: null,
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => createSupabase()),
}));

vi.mock("@/lib/chat-scope", () => ({
  detectChatScope: () => "project",
}));

vi.mock("@togo-todo/agent", () => ({
  DEFAULT_LLM_USAGE_LIMITS: {},
  extractGoogleMapsUrl: vi.fn(),
  recordAgentEvent: vi.fn(),
  runIngestAgent: vi.fn(),
  runPlannerOrchestrator,
  runWithLlmUsage: vi.fn(async (fn: () => Promise<unknown>) => ({
    result: await fn(),
    usage: {
      llmCalls: 1,
      promptTokens: 2,
      completionTokens: 3,
      totalTokens: 5,
      costUsd: null,
      costSource: "test",
    },
  })),
  safeMapsRedirect: vi.fn(),
  searchPlace: vi.fn(),
  translateTextToEnglish: vi.fn(async (text: string) => text),
}));

vi.mock("@togo-todo/ai-rag", () => ({
  hybridRetrieveItemHits: vi.fn(),
}));

vi.mock("@togo-todo/backend", () => ({
  advanceConfirmation,
  createDbAgentTrace,
  createPendingAction: vi.fn(),
  formatConfirmationReply: vi.fn(() => "Saved. Your pending plan was confirmed."),
  findActivePlanPending,
  isConfirmationKeyword: vi.fn((value: string) => value.trim() === "CONFIRM"),
  listItems: vi.fn(async () => []),
  listRecentChatContext: vi.fn(async () => []),
  listWorkspaces: vi.fn(async () => [
    { workspace: { id: "workspace-1", name: "Project" } },
  ]),
  updatePendingPlan,
}));

function chain<T>(result: T) {
  const builder = {
    eq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    is: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    order: vi.fn(() => builder),
    select: vi.fn(() => builder),
    single: vi.fn(async () => result),
    update: vi.fn(() => builder),
  };
  return builder;
}

function pendingActionChain() {
  const builder = {
    eq: vi.fn((field: string, value: unknown) => {
      pendingLookupFilters.push([field, value]);
      return builder;
    }),
    gt: vi.fn(() => builder),
    is: vi.fn((field: string, value: unknown) => {
      pendingLookupFilters.push([field, value]);
      return builder;
    }),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => pendingLookupResult),
    order: vi.fn(() => builder),
    select: vi.fn(() => builder),
  };
  return builder;
}

function createSupabase() {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
    },
    from: vi.fn((table: string) => {
      if (table === "workspace_members") {
        return chain({ data: { id: "member-1" }, error: null });
      }
      if (table === "workspace_messages") {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            workspaceMessageInserts.push(payload);
            const id = payload.message_type === "AI" ? "ai-message-1" : "user-message-1";
            return chain({ data: { id, ...payload }, error: null });
          }),
        };
      }
      if (table === "pending_actions") {
        return pendingActionChain();
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  workspaceMessageInserts.length = 0;
  pendingLookupFilters.length = 0;
  pendingLookupResult = { data: null, error: null };
  createDbAgentTrace.mockResolvedValue({ end: vi.fn() });
  advanceConfirmation.mockResolvedValue({
    pending: { id: "pending-confirm-1" },
  });
  findActivePlanPending.mockResolvedValue(null);
  updatePendingPlan.mockResolvedValue(undefined);
  runPlannerOrchestrator.mockResolvedValue({
    aiContent: "Updated draft. Type CONFIRM to save this plan.",
    latencyMs: 12,
    mocked: false,
    model: "test-model",
    pendingId: "pending-1",
    planner: { intent: "CREATE_ITEM" },
    provider: "test-provider",
  });
});

describe("planner route", () => {
  it("persists AI reply while closing trace", async () => {
    let releaseTrace: (() => void) | undefined;
    const traceDone = new Promise<void>((resolve) => {
      releaseTrace = resolve;
    });
    createDbAgentTrace.mockResolvedValueOnce({
      end: vi.fn(() => traceDone),
    });

    const { POST } = await import("@/app/api/ai/planner/route");
    const responsePromise = POST(
      new Request("http://localhost/api/ai/planner", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: "workspace-1",
          message: "@planner add coffee",
          askPlanner: true,
        }),
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      workspaceMessageInserts.some((payload) => payload.message_type === "AI"),
    ).toBe(true);
    releaseTrace?.();
    expect((await responsePromise).status).toBe(200);
  });

  it("streams planner progress before the final result", async () => {
    runPlannerOrchestrator.mockImplementationOnce(async (input: {
      onProgress?: (event: { step: string; status: string }) => void;
    }) => {
      input.onProgress?.({ step: "understand", status: "active" });
      return {
        aiContent: "Draft ready",
        latencyMs: 12,
        mocked: false,
        model: "test-model",
        pendingId: "pending-stream-1",
        planner: { intent: "CREATE_ITEM" },
        provider: "test-provider",
      };
    });

    const { POST } = await import("@/app/api/ai/planner/route");
    const response = await POST(
      new Request("http://localhost/api/ai/planner", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: "workspace-1",
          message: "@planner add coffee",
          askPlanner: true,
          stream: true,
        }),
      }),
    );

    const progress: string[] = [];
    const result = await consumePlannerStream<{ pendingId: string }>(
      response,
      (event) => progress.push(`${event.step}:${event.status}`),
    );
    expect(progress).toContain("understand:active");
    expect(result.pendingId).toBe("pending-stream-1");
  });

  it("wires active pending callbacks into planner orchestration", async () => {
    const { POST } = await import("@/app/api/ai/planner/route");

    const response = await POST(
      new Request("http://localhost/api/ai/planner", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: "workspace-1",
          message: "@planner make it Saturday",
          askPlanner: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const input = runPlannerOrchestrator.mock.calls[0][0];
    expect(input.deps.findActivePlanPending).toBeTypeOf("function");
    expect(input.deps.updatePendingPlan).toBeTypeOf("function");

    await expect(
      input.deps.findActivePlanPending("workspace-1", "user-1"),
    ).resolves.toBeNull();
    await expect(
      input.deps.updatePendingPlan("pending-1", "workspace-1", "user-1", {
        schema: "plan",
      }),
    ).resolves.toBeUndefined();

    expect(findActivePlanPending).toHaveBeenCalledWith(
      expect.anything(),
      "workspace-1",
      "user-1",
    );
    expect(updatePendingPlan).toHaveBeenCalledWith(
      expect.anything(),
      "pending-1",
      "workspace-1",
      "user-1",
      { schema: "plan" },
    );
  });

  it("links planner reply to triggering user message and returned pending", async () => {
    const { POST } = await import("@/app/api/ai/planner/route");

    const response = await POST(
      new Request("http://localhost/api/ai/planner", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: "workspace-1",
          message: "@planner add Bondi picnic",
          askPlanner: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(workspaceMessageInserts).toHaveLength(2);
    expect(workspaceMessageInserts[1]).toMatchObject({
      message_type: "AI",
      reply_to_message_id: "user-message-1",
      linked_entity_type: "pending_action",
      linked_entity_id: "pending-1",
    });
  });

  it("confirms exact CONFIRM through active pending lookup and linked reply", async () => {
    pendingLookupResult = {
      data: { id: "pending-confirm-1" },
      error: null,
    };

    const { POST } = await import("@/app/api/ai/planner/route");

    const response = await POST(
      new Request("http://localhost/api/ai/planner", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: "workspace-1",
          message: "CONFIRM",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(pendingLookupFilters).toEqual([
      ["workspace_id", "workspace-1"],
      ["initiated_by", "user-1"],
      ["action_type", "CREATE"],
      ["payload_json->>schema", "plan"],
      ["state", "AWAITING_CONFIRM_2"],
      ["before_json", null],
    ]);
    expect(advanceConfirmation).toHaveBeenCalledWith(
      expect.anything(),
      "pending-confirm-1",
      "user-1",
    );
    expect(workspaceMessageInserts[1]).toMatchObject({
      message_type: "AI",
      reply_to_message_id: "user-message-1",
      linked_entity_id: "pending-confirm-1",
    });
    expect(await response.json()).toMatchObject({
      confirmed: true,
      pendingId: "pending-confirm-1",
    });
  });

  it("returns same pending ID after orchestrator updates active draft", async () => {
    const pending = {
      id: "pending-existing",
      workspace_id: "workspace-1",
      action_type: "CREATE",
      payload_json: { schema: "plan" },
      state: "AWAITING_CONFIRM_2",
      expires_at: "2099-01-01T00:00:00.000Z",
    };
    findActivePlanPending.mockResolvedValue(pending);
    updatePendingPlan.mockResolvedValue(pending);
    runPlannerOrchestrator.mockImplementationOnce(async (input) => {
      const active = await input.deps.findActivePlanPending(
        input.workspaceId,
        input.userId,
      );
      const updated = await input.deps.updatePendingPlan(
        active.id,
        input.workspaceId,
        input.userId,
        { schema: "plan", title: "Updated" },
      );
      return {
        aiContent: "Updated draft. Type CONFIRM to save this plan.",
        latencyMs: 12,
        mocked: false,
        model: "test-model",
        pendingId: updated.id,
        planner: { intent: "CREATE_ITEM" },
        provider: "test-provider",
      };
    });

    const { POST } = await import("@/app/api/ai/planner/route");

    const response = await POST(
      new Request("http://localhost/api/ai/planner", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: "workspace-1",
          message: "@planner make it Saturday afternoon",
          askPlanner: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updatePendingPlan).toHaveBeenCalledWith(
      expect.anything(),
      "pending-existing",
      "workspace-1",
      "user-1",
      { schema: "plan", title: "Updated" },
    );
    expect((await response.json()).pendingId).toBe("pending-existing");
    expect(workspaceMessageInserts[1]).toMatchObject({
      reply_to_message_id: "user-message-1",
      linked_entity_id: "pending-existing",
    });
  });
});
