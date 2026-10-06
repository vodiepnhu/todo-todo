"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import type { LlmProvider } from "@/lib/ai/providers";

type ModelOption = { id: string; label: string; tier?: string };

type ProviderMeta = {
  id: LlmProvider;
  label: string;
  defaultModel: string;
  defaultBaseUrl: string | null;
  needsKey: boolean;
  hint: string;
  models: ModelOption[];
};

type Settings = {
  provider: LlmProvider;
  model: string;
  baseUrl: string | null;
  hasApiKey: boolean;
  apiKeyDisplay: string | null;
  encryptionReady: boolean;
};

const CUSTOM_MODEL_VALUE = "__custom__";

export function LlmSettingsCard() {
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [provider, setProvider] = useState<LlmProvider>("openrouter");
  const [model, setModel] = useState("");
  const [modelSelect, setModelSelect] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showKeyField, setShowKeyField] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/settings/llm");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not load settings");
        setProviders(json.providers);
        setSettings(json.settings);
        setProvider(json.settings.provider);
        setModel(json.settings.model);
        setBaseUrl(json.settings.baseUrl ?? "");
        const list: ModelOption[] =
          json.providers.find(
            (p: ProviderMeta) => p.id === json.settings.provider,
          )?.models ?? [];
        const known = list.some((m) => m.id === json.settings.model);
        setModelSelect(known ? json.settings.model : CUSTOM_MODEL_VALUE);
        setError(null);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Could not load LLM settings";
        setError(message);
        toast.error(message);
      }
    })();
  }, []);

  const meta = providers.find((p) => p.id === provider);
  const models = useMemo(() => meta?.models ?? [], [meta]);

  function onProviderChange(id: LlmProvider) {
    setProvider(id);
    const p = providers.find((x) => x.id === id);
    if (p) {
      setModel(p.defaultModel);
      setModelSelect(p.defaultModel);
      setBaseUrl(p.defaultBaseUrl ?? "");
    }
    setApiKeyInput("");
    setShowKeyField(false);
  }

  function onModelSelectChange(value: string) {
    setModelSelect(value);
    if (value !== CUSTOM_MODEL_VALUE) {
      setModel(value);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model: model.trim(),
          baseUrl: baseUrl || null,
          apiKey: apiKeyInput.trim() ? apiKeyInput.trim() : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSettings(json.settings);
      setApiKeyInput("");
      setShowKeyField(false);
      setError(null);
      toast.success("LLM settings saved (key encrypted on server)");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Save failed";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function removeKey() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/llm", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setSettings(json.settings);
      setApiKeyInput("");
      setError(null);
      toast.success("API key removed");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const selectClass =
    "h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm";

  return (
    <Card className="space-y-3">
      <div>
        <p className="text-sm font-medium">AI provider &amp; model</p>
        <p className="text-xs text-muted">
          Pick provider → model. Keys are encrypted (AES-256-GCM); UI only shows{" "}
          {settings?.apiKeyDisplay ?? "••••xxxx"}.
        </p>
      </div>

      {!settings?.encryptionReady && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Set <code>APP_ENCRYPTION_SECRET</code> (≥16 chars) in server env before
          saving keys.
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <label className="block text-xs font-medium text-muted">Provider</label>
      <select
        className={selectClass}
        value={provider}
        onChange={(e) => onProviderChange(e.target.value as LlmProvider)}
      >
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      {meta && <p className="text-xs text-muted">{meta.hint}</p>}

      <label className="block text-xs font-medium text-muted">Model</label>
      <select
        className={selectClass}
        value={modelSelect}
        onChange={(e) => onModelSelectChange(e.target.value)}
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
            {m.tier === "free" ? " · free" : m.tier === "local" ? " · local" : ""}
          </option>
        ))}
        <option value={CUSTOM_MODEL_VALUE}>Other / custom model id…</option>
      </select>

      {(modelSelect === CUSTOM_MODEL_VALUE ||
        provider === "custom" ||
        provider === "ollama") && (
        <Input
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setModelSelect(CUSTOM_MODEL_VALUE);
          }}
          placeholder={
            provider === "ollama"
              ? "e.g. llama3.2:latest"
              : "Paste exact model id"
          }
        />
      )}

      <p className="font-mono text-[11px] text-muted">Active: {model || "—"}</p>

      {(provider === "ollama" ||
        provider === "custom" ||
        provider === "openrouter" ||
        provider === "openai" ||
        provider === "shopaikey") && (
        <>
          <label className="block text-xs font-medium text-muted">
            Base URL{" "}
            {provider === "ollama" || provider === "custom"
              ? "(required)"
              : "(optional)"}
          </label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={
              provider === "shopaikey"
                ? "https://api.shopaikey.com/v1"
                : (meta?.defaultBaseUrl ?? "https://…")
            }
          />
          {provider === "shopaikey" && (
            <p className="text-[11px] text-muted">
              Docs:{" "}
              <a
                className="text-primary underline"
                href="https://shopaikey.com/en/docs/openai-format"
                target="_blank"
                rel="noreferrer"
              >
                OpenAI format
              </a>
              {" · "}
              <a
                className="text-primary underline"
                href="https://shopaikey.com/en/models"
                target="_blank"
                rel="noreferrer"
              >
                model catalog
              </a>
              . Direct (long jobs):{" "}
              <code className="text-[10px]">https://direct.shopaikey.com/v1</code>
            </p>
          )}
        </>
      )}

      {meta?.needsKey !== false && provider !== "ollama" && (
        <div className="space-y-2 rounded-xl border border-border bg-primary-soft/50 p-3">
          <p className="text-xs text-muted">
            Stored key:{" "}
            {settings?.hasApiKey ? (
              <span className="font-mono text-foreground">
                {settings.apiKeyDisplay}
              </span>
            ) : (
              <span className="text-muted">none</span>
            )}
          </p>
          {!showKeyField ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => setShowKeyField(true)}
              >
                {settings?.hasApiKey ? "Replace key" : "Add API key"}
              </Button>
              {settings?.hasApiKey && (
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={removeKey}
                  disabled={saving}
                >
                  Remove key
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                type="password"
                autoComplete="new-password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Paste API key (never shown again)"
              />
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => {
                  setShowKeyField(false);
                  setApiKeyInput("");
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      <Button onClick={save} disabled={saving || !model.trim()}>
        {saving ? "Saving…" : "Save LLM settings"}
      </Button>
    </Card>
  );
}
