import { describe, expect, it, vi } from "vitest";
import { chatCompletionJson } from "@/lib/ai/providers";

describe("LLM provider errors", () => {
  it("passes Ollama thinking mode to the native API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: { content: "{}" } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await chatCompletionJson(
      {
        provider: "ollama",
        model: "qwen3:4b",
        apiKey: null,
        baseUrl: "http://127.0.0.1:11434",
        thinkingMode: "off",
      },
      [{ role: "user", content: "{}" }],
    );

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1].body as string);
    expect(body.think).toBe(false);
  });

  it("passes reasoning effort to OpenAI-compatible providers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await chatCompletionJson(
      {
        provider: "openai",
        model: "o4-mini",
        apiKey: "key",
        baseUrl: "https://api.openai.com/v1",
        thinkingMode: "high",
      },
      [{ role: "user", content: "{}" }],
    );

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1].body as string);
    expect(body.reasoning_effort).toBe("high");
  });

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
