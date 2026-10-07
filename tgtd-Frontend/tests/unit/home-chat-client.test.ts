// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HomeChatClient } from "@/components/home/home-chat-client";
import type { HomeMessage } from "@/types/database";

const fetchMock = vi.fn();
const homeChatService = vi.hoisted(() => ({
  insertHomeMessage: vi.fn(),
  listHomeMessages: vi.fn(async () => [] as HomeMessage[]),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({})),
}));

vi.mock("@/services/home-chat-service", () => ({
  insertHomeMessage: homeChatService.insertHomeMessage,
  listHomeMessages: homeChatService.listHomeMessages,
}));

vi.mock("@/components/chat/chat-model-bar", () => ({
  ChatModelBar: () => React.createElement("div", { "data-testid": "chat-model-bar" }),
}));

vi.mock("@/components/chat/chat-history-menu", () => ({
  ChatHistoryMenu: () => React.createElement("div", { "data-testid": "chat-history-menu" }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), message: vi.fn(), success: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  homeChatService.listHomeMessages.mockResolvedValue([]);
  Element.prototype.scrollIntoView = vi.fn();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("HomeChatClient", () => {
  it("links Google Maps URLs in ordinary AI chat messages", async () => {
    homeChatService.listHomeMessages.mockResolvedValueOnce([
      {
        id: "home-ai-1",
        profile_id: "user-1",
        message_type: "AI",
        content: "Open https://www.google.com/maps/search/?api=1&query=Bondi",
        linked_entity_type: null,
        linked_entity_id: null,
        created_at: "2026-10-08T00:00:00.000Z",
        deleted_at: null,
      },
    ]);

    render(
      React.createElement(HomeChatClient, {
        userId: "user-1",
        settingsHref: "/account/llm",
      }),
    );

    const link = await screen.findByRole("link", { name: /https:\/\/www\.google\.com\/maps/ });
    expect(link.getAttribute("href")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Bondi",
    );
  });

  it("sends new planner draft through cross-project Chat", async () => {
    const onAdd = vi.fn();
    render(
      React.createElement(HomeChatClient, {
        userId: "user-1",
        settingsHref: "/account/llm",
        onAdd,
      }),
    );

    expect(screen.queryByRole("button", { name: "Chat" })).toBeNull();
    expect(screen.queryByText("AI Ready ⚡")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Plan a Kyoto morning" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask Planner" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      askPlanner: true,
      mode: "ask",
      stream: true,
    });
    expect(screen.getByText(/Ask Planner/)).toBeTruthy();
  });

  it("uses the ask-first travel prompt copy", () => {
    render(
      React.createElement(HomeChatClient, {
        userId: "user-1",
        settingsHref: null,
      }),
    );

    expect(
      screen.getByText("Ask AI where to go and what to do."),
    ).toBeTruthy();
  });

  it("shows the /add guidance in the home chat header", () => {
    render(
      React.createElement(HomeChatClient, {
        userId: "user-1",
        settingsHref: null,
      }),
    );

    expect(screen.getByText("+ Add", { exact: true })).toBeTruthy();
  });

  it("shows one focused Chat suggestion", () => {
    render(
      React.createElement(HomeChatClient, {
        userId: "user-1",
        settingsHref: null,
      }),
    );

    expect(
      screen.getAllByRole("button", { name: /spot for a weekend walk/i }),
    ).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /quiet cafe/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /sunset spot/i })).toBeNull();
  });

  it("routes Ask to the selected project without switching to Add mode", async () => {
    render(
      React.createElement(HomeChatClient, {
        userId: "user-1",
        settingsHref: null,
        projects: [{ id: "project-sydney", name: "Sydney" }],
      }),
    );

    fireEvent.change(screen.getByRole("combobox", { name: /chat scope/i }), {
      target: { value: "project-sydney" },
    });
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "What should I do?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask Planner" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      workspaceId: "project-sydney",
      mode: "ask",
    });
  });

  it("tints the chat frame with selected project color", () => {
    render(
      React.createElement(HomeChatClient, {
        userId: "user-1",
        settingsHref: null,
        projects: [{ id: "project-sydney", name: "Sydney", color: "#10b981" }],
      }),
    );

    fireEvent.change(screen.getByRole("combobox", { name: /chat scope/i }), {
      target: { value: "project-sydney" },
    });

    const frame = screen.getByTestId("home-chat-frame");
    expect(frame.style.borderColor).toContain("rgba(16, 185, 129");
    expect(frame.style.background).toContain("rgba(16, 185, 129");
  });

  it("shows the active wishlist in the main title", () => {
    render(
      React.createElement(HomeChatClient, {
        userId: "user-1",
        settingsHref: null,
        projects: [{ id: "project-sydney", name: "Sydney", color: "#10b981" }],
      }),
    );

    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain(
      "Asking across all wishlists",
    );

    fireEvent.change(screen.getByRole("combobox", { name: /chat scope/i }), {
      target: { value: "project-sydney" },
    });

    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain(
      'Asking in wishlist "Sydney"',
    );
  });

  it("shows a latest-messages control when user scrolls up", () => {
    render(
      React.createElement(HomeChatClient, {
        userId: "user-1",
        settingsHref: null,
      }),
    );

    const messages = screen.getByTestId("home-chat-messages");
    Object.defineProperties(messages, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1000 },
      scrollTop: { configurable: true, writable: true, value: 100 },
    });
    fireEvent.scroll(messages);

    expect(screen.getByRole("button", { name: "Latest messages" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Latest messages" }));
    expect(messages.scrollTop).toBe(1000);
  });

  it("routes /add to Add mode for the selected project", async () => {
    render(
      React.createElement(HomeChatClient, {
        userId: "user-1",
        settingsHref: null,
        projects: [{ id: "project-sydney", name: "Sydney" }],
      }),
    );

    fireEvent.change(screen.getByRole("combobox", { name: /chat scope/i }), {
      target: { value: "project-sydney" },
    });
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "/add Opera House for Saturday" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask Planner" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      workspaceId: "project-sydney",
      mode: "add",
    });
  });

  it("keeps Add mode after More info for the active project draft", async () => {
    homeChatService.listHomeMessages.mockResolvedValueOnce([
      {
        id: "home-draft-1",
        profile_id: "user-1",
        message_type: "AI",
        content: "Draft: Budapest\n📍 Place: Budapest\n[Confirm] pending:p1",
        linked_entity_type: "pending_action",
        linked_entity_id: "p1",
        created_at: "2026-10-08T00:00:00.000Z",
        deleted_at: null,
      },
    ]);

    render(
      React.createElement(HomeChatClient, {
        userId: "user-1",
        settingsHref: null,
        projects: [{ id: "project-budapest", name: "Budapest" }],
      }),
    );

    await screen.findByRole("button", { name: "More info" });
    fireEvent.change(screen.getByRole("combobox", { name: /chat scope/i }), {
      target: { value: "project-budapest" },
    });
    fireEvent.click(screen.getByRole("button", { name: "More info" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Add tram cost for 2 days" },
    });
    fetchMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Ask Planner" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      workspaceId: "project-budapest",
      mode: "add",
    });
  });

  it("aborts an in-flight Planner request from Stop", async () => {
    let requestSignal: AbortSignal | null | undefined;
    fetchMock.mockImplementation((_input, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        requestSignal = init.signal;
        init.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
    );

    render(
      React.createElement(HomeChatClient, {
        userId: "user-1",
        settingsHref: null,
      }),
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Find a place" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask Planner" }));

    fireEvent.click(await screen.findByRole("button", { name: "Stop" }));

    expect(requestSignal?.aborted).toBe(true);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
    });
  });
});
