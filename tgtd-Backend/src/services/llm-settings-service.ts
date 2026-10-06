import { createAdminClient } from "../lib/supabase/admin";
import {
  canEncrypt,
  decryptSecret,
  encryptSecret,
  maskApiKey,
} from "../lib/crypto/secrets";
import type { LlmCallConfig, LlmProvider } from "../lib/ai/providers";
import { LLM_PROVIDERS } from "../lib/ai/providers";
import { getEnv } from "../lib/env";

export type LlmSettingsPublic = {
  provider: LlmProvider;
  model: string;
  baseUrl: string | null;
  hasApiKey: boolean;
  apiKeyDisplay: string | null;
  encryptionReady: boolean;
  /** True when the user has saved a user_llm_settings row. */
  configured: boolean;
};

type Row = {
  provider: string;
  model: string;
  base_url: string | null;
  api_key_ciphertext: string | null;
  api_key_last4: string | null;
  has_api_key: boolean;
};

export async function getLlmSettingsPublic(
  userId: string,
): Promise<LlmSettingsPublic> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("user_llm_settings")
      .select("provider, model, base_url, api_key_last4, has_api_key")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) {
      return {
        provider: "openrouter",
        model: getEnv().OPENROUTER_MODEL,
        baseUrl: null,
        hasApiKey: false,
        apiKeyDisplay: null,
        encryptionReady: canEncrypt(),
        configured: false,
      };
    }

    return {
      provider: data.provider as LlmProvider,
      model: data.model,
      baseUrl: data.base_url,
      hasApiKey: data.has_api_key,
      apiKeyDisplay: data.api_key_last4
        ? `••••••••${data.api_key_last4}`
        : null,
      encryptionReady: canEncrypt(),
      configured: true,
    };
  } catch {
    return {
      provider: "openrouter",
      model: getEnv().OPENROUTER_MODEL,
      baseUrl: null,
      hasApiKey: false,
      apiKeyDisplay: null,
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

    if (data?.has_api_key && data.api_key_ciphertext) {
      const apiKey = decryptSecret(data.api_key_ciphertext);
      return {
        provider: data.provider as LlmProvider,
        model: data.model,
        apiKey,
        baseUrl: data.base_url,
      };
    }

    if (
      data &&
      (data.provider === "ollama" || data.provider === "custom") &&
      data.model
    ) {
      return {
        provider: data.provider as LlmProvider,
        model: data.model,
        apiKey: null,
        baseUrl: data.base_url,
      };
    }

    if (data?.model && env.OPENROUTER_API_KEY) {
      return {
        provider: (data.provider as LlmProvider) || "openrouter",
        model: data.model,
        apiKey: env.OPENROUTER_API_KEY,
        baseUrl: data.base_url || "https://openrouter.ai/api/v1",
      };
    }
  } catch {
    // No admin client / encryption — fall through to env
  }

  if (env.OPENROUTER_API_KEY) {
    return {
      provider: "openrouter",
      model: env.OPENROUTER_MODEL,
      apiKey: env.OPENROUTER_API_KEY,
      baseUrl: "https://openrouter.ai/api/v1",
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

  const meta = LLM_PROVIDERS.find((p) => p.id === input.provider)!;
  let ciphertext: string | null = existing?.api_key_ciphertext ?? null;
  let last4: string | null = existing?.api_key_last4 ?? null;
  let hasKey = existing?.has_api_key ?? false;

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
  } else if (meta.needsKey && !hasKey && !getEnv().OPENROUTER_API_KEY) {
    // allow saving provider/model without key; planner will mock until key set
  }

  const row = {
    user_id: userId,
    provider: input.provider,
    model: input.model.trim(),
    base_url: input.baseUrl?.trim() || meta.defaultBaseUrl || null,
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

export async function clearLlmApiKey(userId: string) {
  return upsertLlmSettings(userId, {
    provider: (await getLlmSettingsPublic(userId)).provider,
    model: (await getLlmSettingsPublic(userId)).model,
    clearApiKey: true,
  });
}

/** Type guard helper for unused Row */
export type _Row = Row;
