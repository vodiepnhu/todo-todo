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
});
