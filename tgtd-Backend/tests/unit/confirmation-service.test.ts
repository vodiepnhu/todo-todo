import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
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
