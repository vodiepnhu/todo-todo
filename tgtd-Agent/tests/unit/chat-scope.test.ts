import { describe, expect, it } from "vitest";
import {
  detectChatScope,
  shouldAskProjectBeforeMutate,
  stripAllPrefix,
} from "@/lib/chat-scope";

describe("detectChatScope", () => {
  it("home route always cross", () => {
    expect(detectChatScope({ message: "ideas?", route: "home" })).toBe("cross");
  });
  it("project default is project", () => {
    expect(detectChatScope({ message: "add milk", route: "project" })).toBe(
      "project",
    );
  });
  it("@all and across projects → cross", () => {
    expect(
      detectChatScope({ message: "@all weekend plans", route: "project" }),
    ).toBe("cross");
    expect(
      detectChatScope({
        message: "across projects what should I do?",
        route: "project",
      }),
    ).toBe("cross");
  });
});

describe("stripAllPrefix", () => {
  it("removes @all", () => {
    expect(stripAllPrefix("@all weekend").trim()).toBe("weekend");
  });
});

describe("shouldAskProjectBeforeMutate", () => {
  it("cross + CREATE asks project", () => {
    expect(
      shouldAskProjectBeforeMutate({
        scope: "cross",
        intent: "CREATE_ITEM",
        resolvedWorkspaceId: null,
      }),
    ).toBe(true);
  });

  it("project scope does not ask", () => {
    expect(
      shouldAskProjectBeforeMutate({
        scope: "project",
        intent: "CREATE_ITEM",
        resolvedWorkspaceId: "w1",
      }),
    ).toBe(false);
  });
});
