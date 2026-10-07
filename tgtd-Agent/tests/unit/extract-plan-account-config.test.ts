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

import { extractPlanFromChat } from "@/lib/ai/extract-plan";

describe("extractPlanFromChat account LLM config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes saved account provider and key to the planner call", async () => {
    const config = {
      provider: "openai" as const,
      model: "gpt-4o-mini",
      apiKey: "account-key",
      baseUrl: "https://api.openai.com/v1",
    };
    mocks.resolveLlmCallConfig.mockResolvedValue(config);
    mocks.chatCompletionJson.mockResolvedValue({
      content: JSON.stringify({
        placeName: "Bondi Beach",
        activities: ["Coastal walk"],
      }),
      model: config.model,
      usage: null,
    });

    const result = await extractPlanFromChat({
      userId: "user-1",
      text: "Bondi Beach Saturday",
      lookupMaps: false,
    });

    expect(result.mocked).toBe(false);
    expect(result.provider).toBe("openai");
    expect(mocks.resolveLlmCallConfig).toHaveBeenCalledWith("user-1");
    expect(mocks.chatCompletionJson).toHaveBeenCalledWith(
      config,
      expect.any(Array),
    );
  });

  it("sends a source-first contract with every form field shape", async () => {
    const config = {
      provider: "openai" as const,
      model: "gpt-4o-mini",
      apiKey: "account-key",
      baseUrl: "https://api.openai.com/v1",
    };
    mocks.resolveLlmCallConfig.mockResolvedValue(config);
    mocks.chatCompletionJson.mockResolvedValue({
      content: JSON.stringify({ placeName: "Bondi Beach" }),
      model: config.model,
      usage: null,
    });

    await extractPlanFromChat({
      userId: "user-1",
      text: "Bondi Beach this Saturday, bring sunscreen",
      lookupMaps: false,
    });

    const messages = mocks.chatCompletionJson.mock.calls[0]?.[1] as Array<{
      role: string;
      content: string;
    }>;
    const payload = JSON.parse(messages[1].content) as {
      schemaHint: Record<string, unknown>;
    };

    expect(messages[0].content).toMatch(/explicit facts from input take priority/i);
    expect(messages[0].content).toMatch(/generate safe suggestions for missing fields/i);
    expect(payload.schemaHint.travel).toEqual({
      from: "string|null",
      to: "string|null",
      transportMode: "string|null",
      estimatedDurationMin: "number|null",
      departureTime: "string|null",
      arrivalTime: "string|null",
      notes: "string|null",
    });
    expect(payload.schemaHint.todos).toEqual([
      { task: "string", status: "pending|done|skipped", priority: "high|medium|low|null", note: "string|null" },
    ]);
    expect(payload.schemaHint.notes).toEqual([
      { type: "general|tip|warning|personal|booking|accessibility|weather", content: "string" },
    ]);
  });

  it("asks the model to retain every useful detail without country grouping", async () => {
    const config = {
      provider: "openai" as const,
      model: "gpt-4o-mini",
      apiKey: "account-key",
      baseUrl: "https://api.openai.com/v1",
    };
    mocks.resolveLlmCallConfig.mockResolvedValue(config);
    mocks.chatCompletionJson.mockResolvedValue({
      content: JSON.stringify({ placeName: "Bondi Beach" }),
      model: config.model,
      usage: null,
    });

    await extractPlanFromChat({
      userId: "user-1",
      text: "Bondi Beach, accessible entrance, book ahead, sunset",
      lookupMaps: false,
    });

    const prompt = mocks.chatCompletionJson.mock.calls[0]?.[1][0].content;
    expect(prompt).toMatch(/extract every explicit detail/i);
    expect(prompt).toMatch(/address|location/i);
    expect(prompt).toMatch(/booking|accessibility|weather/i);
    expect(prompt).toMatch(/preserve|do not drop/i);
    expect(prompt).not.toMatch(/\bcountry\b|quốc gia/i);
  });

  it("distinguishes provider failure from missing account config", async () => {
    mocks.resolveLlmCallConfig.mockResolvedValue({
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: "account-key",
      baseUrl: "https://api.openai.com/v1",
    });
    mocks.chatCompletionJson.mockRejectedValue(new Error("openai HTTP 401"));

    const result = await extractPlanFromChat({
      userId: "user-1",
      text: "Bondi Beach",
      lookupMaps: false,
    });

    expect(result.mocked).toBe(true);
    expect(result.fallbackReason).toBe("provider_error");
    expect(result.fallbackDetail).toBe("openai HTTP 401");
  });

  it("accepts JSON wrapped in a markdown code fence", async () => {
    mocks.resolveLlmCallConfig.mockResolvedValue({
      provider: "shopaikey",
      model: "gpt-5-mini",
      apiKey: "account-key",
      baseUrl: "https://api.shopaikey.com/v1",
    });
    mocks.chatCompletionJson.mockResolvedValue({
      content: '```json\n{"placeName":"TownHall","activities":["Buy Tea"]}\n```',
      model: "gpt-5-mini",
      usage: null,
    });

    const result = await extractPlanFromChat({
      userId: "user-1",
      text: "Go to TownHall to buy tea",
      lookupMaps: false,
    });

    expect(result.mocked).toBe(false);
    expect(result.draft.placeName).toBe("TownHall");
    expect(result.draft.activities).toEqual(["Buy Tea"]);
  });

  it("reports schema mismatch when model JSON has wrong field shapes", async () => {
    mocks.resolveLlmCallConfig.mockResolvedValue({
      provider: "shopaikey",
      model: "gpt-5-mini",
      apiKey: "account-key",
      baseUrl: "https://api.shopaikey.com/v1",
    });
    mocks.chatCompletionJson.mockResolvedValue({
      content: JSON.stringify({ placeName: "TownHall", notes: "buy tea" }),
      model: "gpt-5-mini",
      usage: null,
    });

    const result = await extractPlanFromChat({
      userId: "user-1",
      text: "Go to TownHall to buy tea",
      lookupMaps: false,
    });

    expect(result.mocked).toBe(true);
    expect(result.fallbackReason).toBe("invalid_response");
    expect(result.fallbackDetail).toMatch(/array|string/i);
    expect(result.fallbackDetail).toMatch(/^notes:/);
  });

  it("keeps valid model fields when nested optional fields are omitted", async () => {
    mocks.resolveLlmCallConfig.mockResolvedValue({
      provider: "shopaikey",
      model: "gpt-5-mini",
      apiKey: "account-key",
      baseUrl: "https://api.shopaikey.com/v1",
    });
    mocks.chatCompletionJson.mockResolvedValue({
      content: JSON.stringify({
        placeName: "Bondi Beach",
        experience: { estimatedDurationMin: 120, bestTime: "sunset" },
        travel: { from: "Gordon", estimatedDurationMin: 45 },
        todos: [{ task: "Bring sunscreen" }],
      }),
      model: "gpt-5-mini",
      usage: null,
    });

    const result = await extractPlanFromChat({
      userId: "user-1",
      text: "Bondi Beach from Gordon, 45 minutes, sunset",
      lookupMaps: false,
    });

    expect(result.mocked).toBe(false);
    expect(result.draft.placeName).toBe("Bondi Beach");
    expect(result.draft.experience?.estimatedDurationMin).toBe(120);
    expect(result.draft.travel?.from).toBe("Gordon");
    expect(result.draft.travel?.estimatedDurationMin).toBe(45);
    expect(result.draft.todos[0]?.task).toBe("Bring sunscreen");
  });

  it("accepts common aliases for nested model strings", async () => {
    mocks.resolveLlmCallConfig.mockResolvedValue({
      provider: "shopaikey",
      model: "gpt-5-mini",
      apiKey: "account-key",
      baseUrl: "https://api.shopaikey.com/v1",
    });
    mocks.chatCompletionJson.mockResolvedValue({
      content: JSON.stringify({
        placeName: "Bondi Beach",
        todos: [{ title: "Bring sunscreen" }],
        notes: [{ type: "tip", text: "Arrive early" }],
      }),
      model: "gpt-5-mini",
      usage: null,
    });

    const result = await extractPlanFromChat({
      userId: "user-1",
      text: "Bondi Beach",
      lookupMaps: false,
    });

    expect(result.mocked).toBe(false);
    expect(result.draft.todos[0]?.task).toBe("Bring sunscreen");
    expect(result.draft.notes[0]?.content).toBe("Arrive early");
  });
});
