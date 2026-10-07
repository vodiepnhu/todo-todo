import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { persistPlan } from "../../src/services/plan-persist-service";

vi.mock("../../src/services/plan-persist-service", () => ({ persistPlan: vi.fn() }));
vi.mock("@togo-todo/ai-rag", () => ({
  upsertItemEmbedding: vi.fn(async () => {}),
  deleteItemEmbedding: vi.fn(async () => {}),
  buildItemChunkText: vi.fn(() => "plan"),
}));
import {
  advanceConfirmation,
  findActivePlanPending,
  updatePendingPlan,
} from "../../src/services/confirmation-service";

function clientFor(data: unknown, calls: string[]) {
  const query = {
    select() {
      calls.push("select");
      return query;
    },
    eq(column: string, value: string) {
      calls.push(`eq:${column}:${value}`);
      return query;
    },
    maybeSingle: async () => ({ data, error: null }),
  };
  return {
    from(table: string) {
      calls.push(`from:${table}`);
      return query;
    },
  } as unknown as SupabaseClient;
}

describe("advanceConfirmation isolation", () => {
  it("scopes pending lookup to initiating user", async () => {
    const calls: string[] = [];
    await expect(
      advanceConfirmation(clientFor(null, calls), "pending-1", "user-1"),
    ).rejects.toThrow("Pending not found");
    expect(calls).toContain("eq:initiated_by:user-1");
  });

  it("rejects repeated confirmation after execution", async () => {
    const calls: string[] = [];
    await expect(
      advanceConfirmation(
        clientFor({
          id: "pending-1",
          workspace_id: null,
          initiated_by: "user-1",
          state: "EXECUTED",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        }, calls),
        "pending-1",
        "user-1",
      ),
    ).rejects.toThrow(/Invalid pending state/);
  });
});

function pendingAction(overrides: Record<string, unknown> = {}) {
  return {
    id: "pending-1",
    workspace_id: "workspace-1",
    action_type: "CREATE",
    payload_json: { schema: "plan", title: "Old plan", plan: {} },
    before_json: null,
    after_json: null,
    base_entity_version: null,
    initiated_by: "user-1",
    state: "AWAITING_CONFIRM_2",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    executed_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function pendingQueryClient(data: unknown, calls: string[]) {
  const query = {
    select(columns: string) {
      calls.push(`select:${columns}`);
      return query;
    },
    update(payload: unknown) {
      calls.push(`update:${JSON.stringify(payload)}`);
      return query;
    },
    eq(column: string, value: string) {
      calls.push(`eq:${column}:${value}`);
      return query;
    },
    gt(column: string, value: string) {
      calls.push(`gt:${column}:${value}`);
      return query;
    },
    is(column: string, value: null) {
      calls.push(`is:${column}:${value}`);
      return query;
    },
    order(column: string, options: unknown) {
      calls.push(`order:${column}:${JSON.stringify(options)}`);
      return query;
    },
    limit(value: number) {
      calls.push(`limit:${value}`);
      return query;
    },
    maybeSingle: async () => ({ data, error: null }),
  };
  return {
    from(table: string) {
      calls.push(`from:${table}`);
      return query;
    },
  } as unknown as SupabaseClient;
}

describe("plan pending draft services", () => {
  it("finds newest active plan pending scoped to workspace and user", async () => {
    const calls: string[] = [];
    const pending = pendingAction();

    const result = await findActivePlanPending(
      pendingQueryClient(pending, calls),
      "workspace-1",
      "user-1",
    );

    expect(result).toEqual(pending);
    expect(calls).toContain("from:pending_actions");
    expect(calls).toContain("eq:workspace_id:workspace-1");
    expect(calls).toContain("eq:initiated_by:user-1");
    expect(calls).toContain("eq:action_type:CREATE");
    expect(calls).toContain("eq:state:AWAITING_CONFIRM_2");
    expect(calls.some((call) => call.startsWith("gt:expires_at:"))).toBe(true);
    expect(calls).toContain(
      'order:created_at:{"ascending":false}',
    );
    expect(calls).toContain("limit:1");
  });

  it("updates an active plan pending payload with scoped guards", async () => {
    const calls: string[] = [];
    const updated = pendingAction({
      payload_json: { schema: "plan", title: "New plan", plan: {} },
    });

    const result = await updatePendingPlan(
      pendingQueryClient(updated, calls),
      "pending-1",
      "workspace-1",
      "user-1",
      { schema: "plan", title: "New plan", plan: {} },
    );

    expect(result).toEqual(updated);
    expect(calls).toContain("from:pending_actions");
    expect(calls.some((call) => call.startsWith("update:"))).toBe(true);
    expect(calls.join("\n")).toContain('"payload_json":{"schema":"plan"');
    expect(calls.join("\n")).toContain('"expires_at"');
    expect(calls).toContain("eq:id:pending-1");
    expect(calls).toContain("eq:workspace_id:workspace-1");
    expect(calls).toContain("eq:initiated_by:user-1");
    expect(calls).toContain("eq:action_type:CREATE");
    expect(calls).toContain("eq:state:AWAITING_CONFIRM_2");
    expect(calls.some((call) => call.startsWith("gt:expires_at:"))).toBe(true);
  });

  it("returns null for missing active plan and throws on missing update row", async () => {
    const findCalls: string[] = [];
    await expect(
      findActivePlanPending(
        pendingQueryClient(null, findCalls),
        "workspace-1",
        "user-1",
      ),
    ).resolves.toBeNull();

    const updateCalls: string[] = [];
    await expect(
      updatePendingPlan(
        pendingQueryClient(null, updateCalls),
        "pending-1",
        "workspace-1",
        "user-1",
        { schema: "plan", title: "New plan", plan: {} },
      ),
    ).rejects.toThrow("Pending plan not found");

    expect(updateCalls).toContain("eq:id:pending-1");
    expect(updateCalls).toContain("eq:workspace_id:workspace-1");
    expect(updateCalls).toContain("eq:initiated_by:user-1");
    expect(updateCalls).toContain("eq:state:AWAITING_CONFIRM_2");
  });
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function racingClient(
  row: Record<string, unknown>,
  options?: {
    beforeMembership?: () => Promise<void>;
    failExecutedUpdate?: boolean;
  },
) {
  const filters: Array<(value: Record<string, unknown>) => boolean> = [];
  let table = "";
  let patch: Record<string, unknown> | null = null;
  const query = {
    select() { return query; },
    insert: async () => ({ error: null }),
    update(value: Record<string, unknown>) { patch = value; return query; },
    eq(column: string, value: unknown) {
      const expected = column === "payload_json" || column === "before_json"
        ? JSON.parse(value as string) : value;
      filters.push((record) => JSON.stringify(record[column]) === JSON.stringify(expected));
      return query;
    },
    is(column: string, value: null) {
      filters.push((record) => record[column] === value);
      return query;
    },
    gt(column: string, value: string) {
      filters.push((record) => String(record[column]) > value);
      return query;
    },
    lte(column: string, value: string) {
      filters.push((record) => String(record[column]) <= value);
      return query;
    },
    async maybeSingle() {
      const match = filters.every((filter) => filter(row));
      if (table === "pending_actions" && patch?.state === "EXECUTED" && options?.failExecutedUpdate) {
        return { data: null, error: new Error("finalize failed") };
      }
      const result = table === "workspace_members"
        ? (await options?.beforeMembership?.(), { id: "member-1" })
        : table === "pending_actions" && match
          ? patch ? Object.assign(row, patch) : structuredClone(row)
          : table === "workspaces" ? { name: "Project", tags: [] }
          : null;
      return { data: result, error: null };
    },
    then(resolve: (result: { data: unknown; error: null }) => unknown) {
      return query.maybeSingle().then(resolve);
    },
  };
  return {
    from(name: string) {
      table = name;
      patch = null;
      filters.length = 0;
      return query;
    },
  } as unknown as SupabaseClient;
}

describe("confirmation claim", () => {
  beforeEach(() => {
    vi.mocked(persistPlan).mockReset();
    vi.mocked(persistPlan).mockResolvedValue({ id: "item-1", title: "Bondi" } as never);
  });

  function planRow() {
    return pendingAction({
      payload_json: { schema: "plan", title: "Bondi", plan: { placeName: "Bondi" } },
    });
  }

  it("rejects stale payload before executing", async () => {
    const row = planRow();
    const entered = deferred();
    const release = deferred();
    const client = racingClient(row, { beforeMembership: async () => {
      entered.resolve();
      await release.promise;
    } });
    const confirmation = advanceConfirmation(client, row.id, "user-1");
    await entered.promise;
    await updatePendingPlan(client, row.id, "workspace-1", "user-1", {
      schema: "plan", title: "New", plan: { placeName: "New" },
    });
    release.resolve();
    await expect(confirmation).rejects.toThrow(/changed|already confirmed/i);
    expect(persistPlan).not.toHaveBeenCalled();
    expect(row.state).toBe("AWAITING_CONFIRM_2");
  });

  it("does not expire a row changed after the stale read", async () => {
    const row = planRow();
    row.expires_at = new Date(Date.now() - 60_000).toISOString();
    const client = racingClient(row, { beforeMembership: async () => {
      row.state = "EXECUTED";
    } });
    await expect(advanceConfirmation(client, row.id, "user-1")).rejects.toThrow("Confirmation expired");
    expect(row.state).toBe("EXECUTED");
  });

  it("blocks merge while confirmation owns pending payload", async () => {
    const row = planRow();
    const entered = deferred();
    const release = deferred();
    vi.mocked(persistPlan).mockImplementationOnce(async () => {
      entered.resolve();
      await release.promise;
      return { id: "item-1", title: "Bondi" } as never;
    });
    const client = racingClient(row);
    const confirmation = advanceConfirmation(client, row.id, "user-1");
    await entered.promise;
    await expect(updatePendingPlan(client, row.id, "workspace-1", "user-1", {
      schema: "plan", title: "New", plan: { placeName: "New" },
    })).rejects.toThrow("Pending plan not found");
    release.resolve();
    await confirmation;
    expect(row.payload_json).toMatchObject({ title: "Bondi" });
  });

  it("executes only once across concurrent and repeated confirmations", async () => {
    const row = planRow();
    const entered = deferred();
    const release = deferred();
    vi.mocked(persistPlan).mockImplementationOnce(async () => {
      entered.resolve();
      await release.promise;
      return { id: "item-1", title: "Bondi" } as never;
    });
    const client = racingClient(row);
    const first = advanceConfirmation(client, row.id, "user-1");
    await entered.promise;
    await expect(advanceConfirmation(client, row.id, "user-1")).rejects.toThrow(/already confirmed|Invalid pending state/i);
    release.resolve();
    await first;
    await expect(advanceConfirmation(client, row.id, "user-1")).rejects.toThrow(/Invalid pending state/);
    expect(persistPlan).toHaveBeenCalledTimes(1);
    expect(row.state).toBe("EXECUTED");
  });

  it("releases claim when execution fails before a write", async () => {
    const row = planRow();
    row.payload_json.plan = {};
    const client = racingClient(row);
    await expect(advanceConfirmation(client, row.id, "user-1")).rejects.toThrow();
    expect(row.state).toBe("AWAITING_CONFIRM_2");
    expect(row.before_json).toBeNull();
    await updatePendingPlan(client, row.id, "workspace-1", "user-1", {
      schema: "plan", title: "Bondi", plan: { placeName: "Bondi" },
    });
    await advanceConfirmation(client, row.id, "user-1");
    expect(row.state).toBe("EXECUTED");
  });

  it("keeps claim when a write may have partly succeeded", async () => {
    const row = planRow();
    const client = racingClient(row);
    vi.mocked(persistPlan).mockImplementationOnce(async () => {
      expect(row.before_json).toMatchObject({ __confirmation_claim: expect.any(String) });
      throw new Error("child insert failed");
    });
    await expect(advanceConfirmation(client, row.id, "user-1")).rejects.toThrow(/reconciliation/i);
    expect(row.before_json).toMatchObject({ __confirmation_claim: expect.any(String) });
    await expect(advanceConfirmation(client, row.id, "user-1")).rejects.toThrow("already confirmed");
    expect(persistPlan).toHaveBeenCalledTimes(1);
  });

  it("reports uncertain outcome when final EXECUTED transition fails", async () => {
    const row = planRow();
    const client = racingClient(row, { failExecutedUpdate: true });

    await expect(advanceConfirmation(client, row.id, "user-1")).rejects.toThrow(
      /Execution outcome uncertain.*reconciliation/i,
    );
    expect(persistPlan).toHaveBeenCalledTimes(1);
    expect(row.before_json).toMatchObject({ __confirmation_claim: expect.any(String) });
    expect(row.state).toBe("AWAITING_CONFIRM_2");
  });
});
