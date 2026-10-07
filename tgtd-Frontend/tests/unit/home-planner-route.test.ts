import { beforeEach, describe, expect, it, vi } from "vitest";
import { consumePlannerStream } from "@/lib/chat/planner-stream";

const runPlannerOrchestrator = vi.fn();
const createDbAgentTrace = vi.fn();
const listRecentHomeMessages = vi.fn(
  async () => [] as Array<{ id: string; message_type: string; content: string }>,
);
const homeMessageInserts: Record<string, unknown>[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
    },
    from: vi.fn((table: string) => {
      if (table === "home_messages") {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            homeMessageInserts.push(payload);
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: "home-message-1", ...payload },
                  error: null,
                })),
              })),
            };
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  })),
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
  createDbAgentTrace,
  createPendingAction: vi.fn(),
  findActivePlanPending: vi.fn(async () => null),
  insertHomeMessage: vi.fn(async (_supabase: unknown, payload: Record<string, unknown>) => {
    homeMessageInserts.push(payload);
    return { id: "home-message-1", ...payload };
  }),
  listHomeMessages: vi.fn(async () => []),
  listRecentHomeMessages,
  listItems: vi.fn(async () => []),
  listRecentChatContext: vi.fn(async () => ""),
  listWorkspaces: vi.fn(async () => [
    { workspace: { id: "workspace-1", name: "Weekend" } },
    { workspace: { id: "workspace-2", name: "Japan" } },
  ]),
  isConfirmationKeyword: vi.fn(() => false),
  updatePendingPlan: vi.fn(async () => ({ id: "pending-1" })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  homeMessageInserts.length = 0;
  createDbAgentTrace.mockResolvedValue({ end: vi.fn() });
  runPlannerOrchestrator.mockResolvedValue({
    aiContent: "Draft ready",
    latencyMs: 12,
    mocked: false,
    model: "test-model",
    pendingId: "pending-1",
    planner: { intent: "CREATE_ITEM" },
    provider: "test-provider",
  });
});

describe("home planner route", () => {
  it("persists AI reply while closing trace", async () => {
    let releaseTrace: (() => void) | undefined;
    const traceDone = new Promise<void>((resolve) => {
      releaseTrace = resolve;
    });
    createDbAgentTrace.mockResolvedValueOnce({
      end: vi.fn(() => traceDone),
    });

    const { POST } = await import("@/app/api/ai/home/route");
    const responsePromise = POST(
      new Request("http://localhost/api/ai/home", {
        method: "POST",
        body: JSON.stringify({
          message: "@Planner add coffee",
          askPlanner: true,
        }),
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      homeMessageInserts.some((payload) => payload.messageType === "AI"),
    ).toBe(true);
    releaseTrace?.();
    expect((await responsePromise).status).toBe(200);
  });

  it("streams selected-project progress before the final result", async () => {
    runPlannerOrchestrator.mockImplementationOnce(async (input: {
      onProgress?: (event: { step: string; status: string }) => void;
    }) => {
      input.onProgress?.({ step: "draft", status: "active" });
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

    const { POST } = await import("@/app/api/ai/home/route");
    const response = await POST(
      new Request("http://localhost/api/ai/home", {
        method: "POST",
        body: JSON.stringify({
          message: "@Planner add a relaxed coffee morning",
          askPlanner: true,
          mode: "add",
          workspaceId: "workspace-1",
          stream: true,
        }),
      }),
    );

    const progress: string[] = [];
    const result = await consumePlannerStream<{ pendingId: string }>(
      response,
      (event) => progress.push(`${event.step}:${event.status}`),
    );
    expect(progress).toContain("draft:active");
    expect(result.pendingId).toBe("pending-stream-1");
  });

  it("runs selected project through project-scoped planner flow", async () => {
    const { POST } = await import("@/app/api/ai/home/route");

    const response = await POST(
      new Request("http://localhost/api/ai/home", {
        method: "POST",
        body: JSON.stringify({
          message: "@Planner add a relaxed coffee morning",
          askPlanner: true,
          mode: "add",
          workspaceId: "workspace-1",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const input = runPlannerOrchestrator.mock.calls[0][0];
    expect(input.workspaceId).toBe("workspace-1");
    expect(input.scope).toBe("project");
    expect(input.deps.findActivePlanPending).toBeTypeOf("function");
    expect(input.deps.updatePendingPlan).toBeTypeOf("function");
  });

  it("marks Home Ask as read-only for selected project", async () => {
    const { POST } = await import("@/app/api/ai/home/route");

    const response = await POST(
      new Request("http://localhost/api/ai/home", {
        method: "POST",
        body: JSON.stringify({
          message: "What should I do this weekend?",
          askPlanner: true,
          mode: "ask",
          workspaceId: "workspace-1",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(runPlannerOrchestrator.mock.calls.at(-1)?.[0]).toMatchObject({
      workspaceId: "workspace-1",
      scope: "project",
      readOnly: true,
    });
  });

  it("marks Home Add without a project as unavailable", async () => {
    const { POST } = await import("@/app/api/ai/home/route");

    const response = await POST(
      new Request("http://localhost/api/ai/home", {
        method: "POST",
        body: JSON.stringify({
          message: "/add Opera House",
          askPlanner: true,
          mode: "add",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(runPlannerOrchestrator.mock.calls.at(-1)?.[0]).toMatchObject({
      workspaceId: null,
      scope: "cross",
      readOnly: true,
      addRequiresProject: true,
    });
  });

  it("passes newest Home Chat context and excludes current message", async () => {
    listRecentHomeMessages.mockResolvedValueOnce([
      { id: "home-ai-1", message_type: "AI", content: "1. Icon Siam" },
    ]);

    const { POST } = await import("@/app/api/ai/home/route");
    const response = await POST(
      new Request("http://localhost/api/ai/home", {
        method: "POST",
        body: JSON.stringify({
          message: "@Planner 1",
          askPlanner: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(listRecentHomeMessages).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      20,
      "home-message-1",
    );
    expect(runPlannerOrchestrator.mock.calls.at(-1)?.[0].recentChat).toContain(
      "AI: 1. Icon Siam",
    );
  });
});
