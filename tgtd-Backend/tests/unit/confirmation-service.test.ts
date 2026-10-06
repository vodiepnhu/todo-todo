import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { advanceConfirmation } from "../../src/services/confirmation-service";

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
