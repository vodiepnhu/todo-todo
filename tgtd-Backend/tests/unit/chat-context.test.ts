import { describe, expect, it } from "vitest";
import { listRecentChatContext } from "@/services/chat-context-service";

describe("listRecentChatContext", () => {
  it("formats non-deleted messages newest-last and excludes id", async () => {
    const rows = [
      {
        id: "3",
        message_type: "AI",
        content: "Done",
        created_at: "2026-09-24T03:00:00Z",
      },
      {
        id: "2",
        message_type: "USER",
        content: "go Bondi",
        created_at: "2026-09-24T02:00:00Z",
      },
      {
        id: "1",
        message_type: "USER",
        content: "hi",
        created_at: "2026-09-24T01:00:00Z",
      },
    ];
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              order: () => ({
                limit: async () => ({ data: rows, error: null }),
              }),
            }),
          }),
        }),
      }),
    };
    const text = await listRecentChatContext(supabase as never, "ws", {
      excludeMessageId: "3",
      limit: 20,
    });
    expect(text).toContain("User: hi");
    expect(text).toContain("User: go Bondi");
    expect(text).not.toContain("Done");
  });
});
