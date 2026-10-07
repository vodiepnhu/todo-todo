import { describe, expect, it, vi } from "vitest";
import {
  listHomeMessages,
  listRecentHomeMessages,
} from "@/services/home-chat-service";

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

describe("listRecentHomeMessages", () => {
  it("returns newest messages in chat order and excludes the current message", async () => {
    const rows = [
      { id: "4", created_at: "2026-10-08T04:00:00Z", message_type: "AI", content: "options" },
      { id: "3", created_at: "2026-10-08T03:00:00Z", message_type: "USER", content: "old" },
      { id: "2", created_at: "2026-10-08T02:00:00Z", message_type: "AI", content: "older" },
      { id: "1", created_at: "2026-10-08T01:00:00Z", message_type: "USER", content: "oldest" },
    ];
    const order = vi.fn(() => ({
      limit: vi.fn(async () => ({ data: rows, error: null })),
    }));
    const is = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ is }));
    const select = vi.fn(() => ({ eq }));
    const supabase = { from: vi.fn(() => ({ select })) } as never;

    const result = await listRecentHomeMessages(supabase, "user", 2, "4");

    expect(result.map((row) => row.id)).toEqual(["2", "3"]);
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });
});
