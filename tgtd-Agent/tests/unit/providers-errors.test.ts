import { describe, expect, it, vi } from "vitest";
import { chatCompletionJson } from "@/lib/ai/providers";

describe("LLM provider errors", () => {
  it("calls NVIDIA through its OpenAI-compatible endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "{}" } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await chatCompletionJson(
      {
        provider: "nvidia",
        model: "google/gemma-4-31b-it",
        apiKey: "nvidia-key",
        baseUrl: null,
      },
      [{ role: "user", content: "{}" }],
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer nvidia-key",
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1].body as string);
    expect(body.model).toBe("google/gemma-4-31b-it");
    expect(body.response_format).toBeUndefined();
  });

  it("keeps ShopAIKey response message on HTTP errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { message: "model is not available" } }),
          { status: 400 },
        ),
      ),
    );

    await expect(
      chatCompletionJson(
        {
          provider: "shopaikey",
          model: "gpt-5-mini",
          apiKey: "account-key",
          baseUrl: "https://api.shopaikey.com/v1",
        },
        [{ role: "user", content: "{}" }],
      ),
    ).rejects.toThrow("shopaikey HTTP 400: model is not available");
  });
});
