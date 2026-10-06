import { describe, expect, it, vi } from "vitest";
import { listHomeMessages } from "@/services/home-chat-service";

function mockClient(result: { data: unknown; error: unknown }) {
  const limit = vi.fn().mockResolvedValue(result);
  const order = vi.fn(() => ({ limit }));
  const is = vi.fn(() => ({ order }));
  const eq = vi.fn(() => ({ is }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { from } as never;
}

describe("listHomeMessages", () => {
  it("throws Error with PostgREST message (not opaque 'error')", async () => {
    const supabase = mockClient({
      data: null,
      // supabase-js fetch-fail path returns a plain object, not Error
      error: {
        message: "TypeError: Failed to fetch",
        details: "",
        hint: "",
        code: "",
      },
    });

    let caught: unknown;
    try {
      await listHomeMessages(
        supabase,
        "a0000000-0000-4000-8000-000000000001",
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("TypeError: Failed to fetch");
  });
});
