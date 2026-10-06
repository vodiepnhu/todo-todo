import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { ChatModelBar } from "@/components/chat/chat-model-bar";

afterEach(() => {
  cleanup();
});

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("ChatModelBar", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows More settings only when not configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          settings: {
            provider: "openrouter",
            model: "x",
            baseUrl: null,
            hasApiKey: false,
            configured: false,
          },
          providers: [],
        }),
      }),
    );

    render(<ChatModelBar settingsHref="/projects/w1/settings#llm" />);

    await waitFor(() => {
      expect(screen.getByText("More settings")).toBeTruthy();
    });
    expect(screen.queryByLabelText("Model")).toBeNull();
    expect(
      screen.getByText(/Set up provider & API key/i),
    ).toBeTruthy();
  });

  it("shows model dropdown when configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          settings: {
            provider: "openrouter",
            model: "google/gemma-4-31b-it:free",
            baseUrl: "https://openrouter.ai/api/v1",
            hasApiKey: true,
            configured: true,
          },
          providers: [
            {
              id: "openrouter",
              label: "OpenRouter",
              models: [
                {
                  id: "google/gemma-4-31b-it:free",
                  label: "Gemma 4 31B",
                  tier: "free",
                },
                { id: "openai/gpt-4o-mini", label: "GPT-4o mini", tier: "paid" },
              ],
            },
          ],
        }),
      }),
    );

    render(<ChatModelBar settingsHref="/projects/w1/settings#llm" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Model")).toBeTruthy();
    });
    expect(
      screen.getByRole("link", { name: "More settings" }),
    ).toBeTruthy();
  });

  it("PUTs model change keeping provider", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          settings: {
            provider: "openrouter",
            model: "google/gemma-4-31b-it:free",
            baseUrl: "https://openrouter.ai/api/v1",
            hasApiKey: true,
            configured: true,
          },
          providers: [
            {
              id: "openrouter",
              label: "OpenRouter",
              models: [
                {
                  id: "google/gemma-4-31b-it:free",
                  label: "Gemma",
                },
                { id: "openai/gpt-4o-mini", label: "GPT-4o mini" },
              ],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          settings: {
            provider: "openrouter",
            model: "openai/gpt-4o-mini",
            baseUrl: "https://openrouter.ai/api/v1",
            hasApiKey: true,
            configured: true,
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<ChatModelBar settingsHref="/projects/w1/settings#llm" />);

    await waitFor(() => screen.getByLabelText("Model"));
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "openai/gpt-4o-mini" },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const putCall = fetchMock.mock.calls[1];
    expect(putCall[0]).toBe("/api/settings/llm");
    expect(putCall[1].method).toBe("PUT");
    expect(JSON.parse(putCall[1].body)).toEqual({
      provider: "openrouter",
      model: "openai/gpt-4o-mini",
      baseUrl: "https://openrouter.ai/api/v1",
    });
  });
});
