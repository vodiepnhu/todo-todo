import { describe, expect, it } from "vitest";
import { getAuthenticatedUserId } from "../../src/modules/auth/authenticated-user";

describe("getAuthenticatedUserId", () => {
  it("returns authenticated Supabase user ID", async () => {
    const client = {
      auth: {
        getUser: async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    };

    await expect(getAuthenticatedUserId(client)).resolves.toBe("user-1");
  });

  it("rejects missing user", async () => {
    const client = {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: null,
        }),
      },
    };

    await expect(getAuthenticatedUserId(client)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("normalizes provider errors", async () => {
    const client = {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: { message: "session lookup failed" },
        }),
      },
    };

    await expect(getAuthenticatedUserId(client)).rejects.toMatchObject({
      code: "AUTH_LOOKUP_FAILED",
      message: "session lookup failed",
    });
  });
});
