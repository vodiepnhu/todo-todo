import { describe, expect, it } from "vitest";
import {
  hasConfirmPendingMarker,
  isExecutedConfirmationResponse,
  latestConfirmableMessageIds,
  splitChatContent,
} from "@/lib/chat/chat-content";

describe("splitChatContent", () => {
  it("links trusted Google Maps URLs", () => {
    expect(
      splitChatContent("Map: https://www.google.com/maps/search/?api=1&query=Bondi"),
    ).toEqual([
      { text: "Map: " },
      {
        text: "https://www.google.com/maps/search/?api=1&query=Bondi",
        href: "https://www.google.com/maps/search/?api=1&query=Bondi",
      },
    ]);
  });

  it("keeps non-Maps URLs and javascript tokens as text", () => {
    expect(splitChatContent("Open https://example.com or javascript:alert(1)")).toEqual([
      { text: "Open https://example.com or javascript:alert(1)" },
    ]);
  });

  it("preserves surrounding text and newlines", () => {
    expect(splitChatContent("First\nhttps://maps.app.goo.gl/example\nLast")).toEqual([
      { text: "First\n" },
      {
        text: "https://maps.app.goo.gl/example",
        href: "https://maps.app.goo.gl/example",
      },
      { text: "\nLast" },
    ]);
  });
});

describe("hasConfirmPendingMarker", () => {
  it("requires the explicit confirm marker", () => {
    expect(hasConfirmPendingMarker("Draft ready\n[Confirm] pending: abc")).toBe(true);
    expect(hasConfirmPendingMarker("Saved")).toBe(false);
  });
});

describe("latestConfirmableMessageIds", () => {
  it("keeps Confirm only on latest draft bubble for each pending action", () => {
    expect(
      latestConfirmableMessageIds([
        {
          id: "draft-1",
          message_type: "AI",
          content: "First\n[Confirm] pending: p1",
          linked_entity_type: "pending_action",
          linked_entity_id: "p1",
        },
        {
          id: "draft-2",
          message_type: "AI",
          content: "Updated\n[Confirm] pending: p1",
          linked_entity_type: "pending_action",
          linked_entity_id: "p1",
        },
        {
          id: "saved-1",
          message_type: "AI",
          content: "Saved.",
          linked_entity_type: "pending_action",
          linked_entity_id: "p2",
        },
        {
          id: "draft-3",
          message_type: "AI",
          content: "Draft\n[Confirm] pending: p2",
          linked_entity_type: "pending_action",
          linked_entity_id: "p2",
        },
      ]),
    ).toEqual(new Set(["draft-2", "draft-3"]));
  });

  it("hides old draft after Saved response for same pending action", () => {
    expect(
      latestConfirmableMessageIds([
        {
          id: "draft-1",
          message_type: "AI",
          content: "Draft\n[Confirm] pending: p1",
          linked_entity_type: "pending_action",
          linked_entity_id: "p1",
        },
        {
          id: "saved-1",
          message_type: "AI",
          content: "Saved.",
          linked_entity_type: "pending_action",
          linked_entity_id: "p1",
        },
      ]),
    ).toEqual(new Set());
  });

  it("hides confirmed pending actions in current session", () => {
    expect(
      latestConfirmableMessageIds(
        [
          {
            id: "draft-1",
            message_type: "AI",
            content: "Draft\n[Confirm] pending: p1",
            linked_entity_type: "pending_action",
            linked_entity_id: "p1",
          },
        ],
        new Set(["p1"]),
      ),
    ).toEqual(new Set());
  });
});

describe("isExecutedConfirmationResponse", () => {
  it("recognizes exact planner confirmation success", () => {
    expect(
      isExecutedConfirmationResponse({
        confirmed: true,
        pending: { state: "EXECUTED" },
      }),
    ).toBe(true);
    expect(
      isExecutedConfirmationResponse({
        confirmed: false,
        pending: { state: "AWAITING_CONFIRM_2" },
      }),
    ).toBe(false);
  });
});
