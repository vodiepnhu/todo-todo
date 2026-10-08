import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
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

  it("shows the active model without model suggestions", async () => {
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

    await waitFor(() => expect(screen.getByText("google/gemma-4-31b-it:free")).toBeTruthy());
    expect(screen.queryByLabelText("Model")).toBeNull();
    expect(
      screen.getByRole("link", { name: "More settings" }),
    ).toBeTruthy();
  });
});
