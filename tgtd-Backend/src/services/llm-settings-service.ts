import { createAdminClient } from "../lib/supabase/admin";
import {
  canEncrypt,
  decryptSecret,
  encryptSecret,
  maskApiKey,
} from "../lib/crypto/secrets";
import type { LlmCallConfig, LlmProvider } from "../lib/ai/providers";
import { normalizeThinkingMode, type ThinkingMode } from "@togo-todo/agent";
import { LLM_PROVIDERS } from "../lib/ai/providers";
import { getEnv } from "../lib/env";

export type LlmSettingsPublic = {
  provider: LlmProvider;
  model: string;
  baseUrl: string | null;
  thinkingMode: ThinkingMode;
  hasApiKey: boolean;
  apiKeyDisplay: string | null;
  keysByProvider: Partial<Record<LlmProvider, LlmProviderKeyStatus>>;
  encryptionReady: boolean;
  /** True when the user has saved a user_llm_settings row. */
  configured: boolean;
};

export type LlmProviderKeyStatus = {
  hasApiKey: boolean;
  apiKeyDisplay: string | null;
};

type Row = {
  provider: string;
  model: string;
  base_url: string | null;
  thinking_mode: string | null;
  api_key_ciphertext: string | null;
  api_key_last4: string | null;
  has_api_key: boolean;
};

type ProviderKeyRow = {
  user_id: string;
  provider: LlmProvider;
  api_key_ciphertext: string | null;
  api_key_last4: string | null;
  has_api_key: boolean;
};

function keyStatus(
  row: Pick<ProviderKeyRow, "api_key_last4" | "has_api_key"> | null | undefined,
): LlmProviderKeyStatus {
  return {
    hasApiKey: Boolean(row?.has_api_key),
    apiKeyDisplay: row?.api_key_last4 ? `••••••••${row.api_key_last4}` : null,
  };
}

function providerKeyMap(
  rows: ProviderKeyRow[],
): Partial<Record<LlmProvider, LlmProviderKeyStatus>> {
  return Object.fromEntries(
    rows.map((row) => [row.provider, keyStatus(row)]),
  ) as Partial<Record<LlmProvider, LlmProviderKeyStatus>>;
}

function legacyKeyStatus(
  data: Row | null,
  provider: string,
): LlmProviderKeyStatus | null {
  if (!data || data.provider !== provider) return null;
  return keyStatus(data);
}

export async function getLlmSettingsPublic(
  userId: string,
): Promise<LlmSettingsPublic> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("user_llm_settings")
      .select("provider, model, base_url, thinking_mode, api_key_last4, has_api_key")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: providerKeyRows } = await admin
      .from("user_llm_provider_keys")
      .select("provider, api_key_last4, has_api_key")
      .eq("user_id", userId);
    const keysByProvider = providerKeyMap(
      (providerKeyRows ?? []) as ProviderKeyRow[],
    );

    if (!data) {
      return {
        provider: "openrouter",
        model: getEnv().OPENROUTER_MODEL,
        baseUrl: null,
        thinkingMode: "auto",
        hasApiKey: false,
        apiKeyDisplay: null,
        keysByProvider,
        encryptionReady: canEncrypt(),
        configured: false,
      };
    }

    if (!(data.provider in keysByProvider)) {
      const legacy = legacyKeyStatus(data as Row, data.provider);
      if (legacy) keysByProvider[data.provider as LlmProvider] = legacy;
    }
    const activeKey = keysByProvider[data.provider as LlmProvider] ?? {
      hasApiKey: false,
      apiKeyDisplay: null,
    };

    return {
      provider: data.provider as LlmProvider,
      model: data.model,
      baseUrl: data.base_url,
      thinkingMode: normalizeThinkingMode(data.thinking_mode),
      hasApiKey: activeKey.hasApiKey,
      apiKeyDisplay: activeKey.apiKeyDisplay,
      keysByProvider,
      encryptionReady: canEncrypt(),
      configured: true,
    };
  } catch {
    return {
      provider: "openrouter",
      model: getEnv().OPENROUTER_MODEL,
      baseUrl: null,
      thinkingMode: "auto",
        hasApiKey: false,
        apiKeyDisplay: null,
        keysByProvider: {},
        encryptionReady: canEncrypt(),
      configured: false,
    };
  }
}

/** Decrypt key server-side only. Never return to client. */
export async function resolveLlmCallConfig(
  userId: string,
): Promise<LlmCallConfig | null> {
  const env = getEnv();
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("user_llm_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      const { data: providerKey } = await admin
        .from("user_llm_provider_keys")
        .select("provider, api_key_ciphertext, has_api_key")
        .eq("user_id", userId)
        .eq("provider", data.provider)
        .maybeSingle();
      const ciphertext = providerKey
        ? providerKey.api_key_ciphertext
        : data.api_key_ciphertext;
      const hasKey = providerKey
        ? providerKey.has_api_key
        : data.has_api_key;

      if (hasKey && ciphertext) {
        const apiKey = decryptSecret(ciphertext);
        return {
          provider: data.provider as LlmProvider,
          model: data.model,
          apiKey,
          baseUrl: data.base_url,
          thinkingMode: normalizeThinkingMode(data.thinking_mode),
        };
      }

      if (
        (data.provider === "ollama" || data.provider === "custom") &&
        data.model
      ) {
        return {
          provider: data.provider as LlmProvider,
          model: data.model,
          apiKey: null,
          baseUrl: data.base_url,
          thinkingMode: normalizeThinkingMode(data.thinking_mode),
        };
      }

      if (
        data.provider === "openrouter" &&
        data.model &&
        env.OPENROUTER_API_KEY
      ) {
        return {
          provider: "openrouter",
          model: data.model,
          apiKey: env.OPENROUTER_API_KEY,
          baseUrl: data.base_url || "https://openrouter.ai/api/v1",
          thinkingMode: normalizeThinkingMode(data.thinking_mode),
        };
      }
    }
  } catch {
    // No admin client / encryption — fall through to env
  }

  if (env.OPENROUTER_API_KEY && env.OPENROUTER_MODEL) {
    return {
      provider: "openrouter",
      model: env.OPENROUTER_MODEL,
      apiKey: env.OPENROUTER_API_KEY,
      baseUrl: "https://openrouter.ai/api/v1",
      thinkingMode: "auto",
    };
  }

  return null;
}

export async function upsertLlmSettings(
  userId: string,
  input: {
    provider: LlmProvider;
    model: string;
    baseUrl?: string | null;
    thinkingMode?: ThinkingMode;
    apiKey?: string | null;
    clearApiKey?: boolean;
  },
): Promise<LlmSettingsPublic> {
  if (!LLM_PROVIDERS.some((p) => p.id === input.provider)) {
    throw new Error("Invalid provider");
  }
  if (!input.model.trim()) throw new Error("Model is required");

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("user_llm_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: existingProviderKey } = await admin
    .from("user_llm_provider_keys")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", input.provider)
    .maybeSingle();

  const meta = LLM_PROVIDERS.find((p) => p.id === input.provider)!;
  let ciphertext = existingProviderKey?.api_key_ciphertext ?? null;
  let last4 = existingProviderKey?.api_key_last4 ?? null;
  let hasKey = existingProviderKey?.has_api_key ?? false;

  if (!existingProviderKey && existing?.provider === input.provider) {
    ciphertext = existing.api_key_ciphertext ?? null;
    last4 = existing.api_key_last4 ?? null;
    hasKey = existing.has_api_key ?? false;
  }

  if (input.clearApiKey) {
    ciphertext = null;
    last4 = null;
    hasKey = false;
  } else if (input.apiKey && input.apiKey.trim()) {
    if (!canEncrypt()) {
      throw new Error(
        "Server missing APP_ENCRYPTION_SECRET — cannot store API keys",
      );
    }
    // Reject accidental paste of masked value
    if (input.apiKey.includes("•")) {
      throw new Error("Paste a full API key, not the masked display");
    }
    const key = input.apiKey.trim();
    ciphertext = encryptSecret(key);
    last4 = maskApiKey(key).last4;
    hasKey = true;
  }

  const providerKeyRow = {
    user_id: userId,
    provider: input.provider,
    api_key_ciphertext: ciphertext,
    api_key_last4: last4,
    has_api_key: hasKey,
    updated_at: new Date().toISOString(),
  };
  const { error: providerKeyError } = await admin
    .from("user_llm_provider_keys")
    .upsert(providerKeyRow, { onConflict: "user_id,provider" });
  if (providerKeyError) throw providerKeyError;

  const row = {
    user_id: userId,
    provider: input.provider,
    model: input.model.trim(),
    base_url: input.baseUrl?.trim() || meta.defaultBaseUrl || null,
    thinking_mode: input.thinkingMode ?? normalizeThinkingMode(existing?.thinking_mode),
    api_key_ciphertext: ciphertext,
    api_key_last4: last4,
    has_api_key: hasKey,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from("user_llm_settings").upsert(row, {
    onConflict: "user_id",
  });
  if (error) throw error;

  // Never select ciphertext for response
  return getLlmSettingsPublic(userId);
}

export async function clearLlmApiKey(
  userId: string,
  provider?: LlmProvider,
) {
  const current = await getLlmSettingsPublic(userId);
  const targetProvider = provider ?? current.provider;
  const admin = createAdminClient();
  const { error } = await admin.from("user_llm_provider_keys").upsert(
    {
      user_id: userId,
      provider: targetProvider,
      api_key_ciphertext: null,
      api_key_last4: null,
      has_api_key: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
  if (error) throw error;

  if (current.provider === targetProvider) {
    return upsertLlmSettings(userId, {
      provider: current.provider,
      model: current.model,
      baseUrl: current.baseUrl,
      thinkingMode: current.thinkingMode,
      clearApiKey: true,
    });
  }
  return getLlmSettingsPublic(userId);
}

/** Type guard helper for unused Row */
export type _Row = Row;
