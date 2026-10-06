import { describe, expect, it } from "vitest";
import {
  dayKeyLocal,
  formatBubbleTime,
  groupMessagesByDay,
  messageIdsForPendingThread,
} from "@/lib/chat/chat-history";
import type { WorkspaceMessage } from "@/types/database";

function msg(
  partial: Partial<WorkspaceMessage> & Pick<WorkspaceMessage, "id" | "created_at">,
): WorkspaceMessage {
  return {
    workspace_id: "w",
    sender_profile_id: "u",
    message_type: "USER",
    content: "hi",
    reply_to_message_id: null,
    linked_entity_type: null,
    linked_entity_id: null,
    edited_at: null,
    deleted_at: null,
    ...partial,
  };
}

describe("chat-history helpers", () => {
  it("groups by local day key", () => {
    const a = msg({
      id: "1",
      created_at: "2026-09-23T22:00:00.000Z",
      content: "a",
    });
    const b = msg({
      id: "2",
      created_at: "2026-09-24T10:00:00.000Z",
      content: "b",
    });
    const groups = groupMessagesByDay([a, b], "UTC");
    expect(groups.map((g) => g.dayKey)).toEqual(["2026-09-23", "2026-09-24"]);
  });

  it("finds pending thread: linked AI + prior USER", () => {
    const user = msg({
      id: "u1",
      created_at: "2026-09-24T01:00:00.000Z",
      message_type: "USER",
      content: "@Planner go Bondi",
    });
    const ai = msg({
      id: "a1",
      created_at: "2026-09-24T01:00:05.000Z",
      message_type: "AI",
      content: "Draft ready",
      linked_entity_type: "pending_action",
      linked_entity_id: "p1",
      reply_to_message_id: "u1",
    });
    const other = msg({
      id: "u2",
      created_at: "2026-09-24T02:00:00.000Z",
      content: "unrelated",
    });
    const ids = messageIdsForPendingThread([user, ai, other], "p1");
    expect(ids.sort()).toEqual(["a1", "u1"]);
  });

  it("formats bubble time", () => {
    expect(formatBubbleTime("2026-09-24T03:15:00.000Z", "UTC")).toMatch(/03:15/);
  });

  it("dayKeyLocal stable", () => {
    expect(dayKeyLocal("2026-09-24T12:00:00.000Z", "UTC")).toBe("2026-09-24");
  });
});
