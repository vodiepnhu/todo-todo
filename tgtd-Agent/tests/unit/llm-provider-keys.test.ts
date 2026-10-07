import { beforeEach, describe, expect, it, vi } from "vitest";

type SettingsRow = {
  user_id: string;
  provider: string;
  model: string;
  base_url: string | null;
  api_key_ciphertext: string | null;
  api_key_last4: string | null;
  has_api_key: boolean;
};

type KeyRow = {
  user_id: string;
  provider: string;
  api_key_ciphertext: string | null;
  api_key_last4: string | null;
  has_api_key: boolean;
};

const mocks = vi.hoisted(() => {
  const state: {
    settings: SettingsRow | null;
    keys: Map<string, KeyRow>;
  } = { settings: null, keys: new Map() };

  const admin = {
    from(table: string) {
      const filters: Record<string, string> = {};
      const query = {
        select: () => query,
        eq: (column: string, value: string) => {
          filters[column] = value;
          return query;
        },
        maybeSingle: async () => {
          if (table === "user_llm_settings") {
            return { data: state.settings, error: null };
          }
          return {
            data: state.keys.get(`${filters.user_id}:${filters.provider}`) ?? null,
            error: null,
          };
        },
        upsert: async (row: SettingsRow | KeyRow) => {
          if (table === "user_llm_settings") state.settings = row as SettingsRow;
          else {
            const key = row as KeyRow;
            state.keys.set(`${key.user_id}:${key.provider}`, key);
          }
          return { error: null };
        },
        then: (resolve: (value: { data: KeyRow[]; error: null }) => unknown) =>
          Promise.resolve({
            data: [...state.keys.values()].filter(
              (row) => row.user_id === filters.user_id,
            ),
            error: null,
          }).then(resolve),
      };
      return query;
    },
  };

  return { state, admin };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mocks.admin,
}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({ OPENROUTER_API_KEY: undefined, OPENROUTER_MODEL: "" }),
}));

import {
  resolveLlmCallConfig,
  upsertLlmSettings,
} from "@/services/llm-settings-service";

describe("provider-specific LLM keys", () => {
  beforeEach(() => {
    mocks.state.settings = null;
    mocks.state.keys.clear();
    process.env.APP_ENCRYPTION_SECRET = "test-secret-with-16-chars";
  });

  it("keeps OpenAI key when saving Gemini key and switching back", async () => {
    await upsertLlmSettings("user-1", {
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: "openai-key",
    });
    await upsertLlmSettings("user-1", {
      provider: "gemini",
      model: "gemini-2.0-flash",
      apiKey: "gemini-key",
    });

    const openAiSettings = await upsertLlmSettings("user-1", {
      provider: "openai",
      model: "gpt-4o-mini",
    });
    const config = await resolveLlmCallConfig("user-1");

    expect(openAiSettings.apiKeyDisplay).toBe("••••••••-key");
    expect(openAiSettings.keysByProvider.openai?.apiKeyDisplay).toBe(
      "••••••••-key",
    );
    expect(openAiSettings.keysByProvider.gemini?.apiKeyDisplay).toBe(
      "••••••••-key",
    );
    expect(config?.provider).toBe("openai");
    expect(config?.apiKey).toBe("openai-key");
  });
});
