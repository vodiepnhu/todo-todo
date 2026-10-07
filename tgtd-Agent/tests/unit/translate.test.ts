import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveLlmCallConfig: vi.fn(),
  chatCompletionJson: vi.fn(),
}));

vi.mock("@/services/llm-settings-service", () => ({
  resolveLlmCallConfig: mocks.resolveLlmCallConfig,
}));

vi.mock("@/lib/ai/providers", () => ({
  chatCompletionJson: mocks.chatCompletionJson,
}));

import { translateTextToEnglish } from "@/lib/ai/translate";

describe("translateTextToEnglish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns original text when no provider is configured", async () => {
    mocks.resolveLlmCallConfig.mockResolvedValue(null);

    await expect(translateTextToEnglish("user-1", "Đi dạo cuối tuần")).resolves.toBe(
      "Đi dạo cuối tuần",
    );
    expect(mocks.chatCompletionJson).not.toHaveBeenCalled();
  });

  it("translates through configured provider", async () => {
    mocks.resolveLlmCallConfig.mockResolvedValue({
      provider: "openrouter",
      model: "test-model",
      apiKey: "key",
      baseUrl: null,
    });
    mocks.chatCompletionJson.mockResolvedValue({
      content: JSON.stringify({ text: "Weekend walk" }),
      model: "test-model",
      usage: null,
    });

    await expect(translateTextToEnglish("user-1", "Đi dạo cuối tuần")).resolves.toBe(
      "Weekend walk",
    );
  });

  it("falls back to original text when translation fails", async () => {
    mocks.resolveLlmCallConfig.mockResolvedValue({
      provider: "openrouter",
      model: "test-model",
      apiKey: "key",
      baseUrl: null,
    });
    mocks.chatCompletionJson.mockRejectedValue(new Error("provider unavailable"));

    await expect(translateTextToEnglish("user-1", "Đi dạo cuối tuần")).resolves.toBe(
      "Đi dạo cuối tuần",
    );
  });
});
