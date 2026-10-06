import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "../../src/contracts/database";
import { createProfileRepository } from "../../src/modules/profiles/profile.repository";

const profile: Profile = {
  id: "user-1",
  display_name: "Demo",
  avatar_url: null,
  timezone: "UTC",
  default_travel_mode: "driving",
  agentops_full_payload: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function clientFor(result: { data: Profile | null; error: { message?: string } | null }) {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      calls.push("from:" + table);
      return {
        select(fields: string) {
          calls.push("select:" + fields);
          return {
            eq(column: string, value: string) {
              calls.push("eq:" + column + ":" + value);
              return {
                maybeSingle: async () => result,
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("profile repository", () => {
  it("maps profile query result", async () => {
    const { client, calls } = clientFor({ data: profile, error: null });
    const repository = createProfileRepository(client);

    await expect(repository.getByUserId(profile.id)).resolves.toEqual(profile);
    expect(calls).toEqual([
      "from:profiles",
      "select:*",
      "eq:id:user-1",
    ]);
  });

  it("returns null for missing profile", async () => {
    const { client } = clientFor({ data: null, error: null });
    await expect(createProfileRepository(client).getByUserId("missing")).resolves.toBeNull();
  });

  it("normalizes plain Supabase errors", async () => {
    const { client } = clientFor({
      data: null,
      error: { message: "profile query failed" },
    });

    await expect(createProfileRepository(client).getByUserId(profile.id)).rejects.toThrow(
      "profile query failed",
    );
  });
});
