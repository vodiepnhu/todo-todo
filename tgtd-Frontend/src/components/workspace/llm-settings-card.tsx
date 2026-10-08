"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import type { LlmProvider } from "@/lib/ai/providers";
import { useLocale } from "@/lib/i18n";

type ProviderMeta = {
  id: LlmProvider;
  label: string;
  defaultBaseUrl: string | null;
  needsKey: boolean;
  hint: string;
};

type Settings = {
  provider: LlmProvider;
  model: string;
  baseUrl: string | null;
  hasApiKey: boolean;
  apiKeyDisplay: string | null;
  keysByProvider?: Partial<
    Record<LlmProvider, { hasApiKey: boolean; apiKeyDisplay: string | null }>
  >;
  encryptionReady: boolean;
};

export function LlmSettingsCard() {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [provider, setProvider] = useState<LlmProvider>("openrouter");
  const [model, setModel] = useState("");
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
        if (!res.ok) throw new Error(json.error || (vi ? "Không thể tải cài đặt" : "Could not load settings"));
        setProviders(json.providers);
        setSettings(json.settings);
        setProvider(json.settings.provider);
        setModel(json.settings.model);
        setBaseUrl(json.settings.baseUrl ?? "");
        setError(null);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : (vi ? "Không thể tải cài đặt LLM" : "Could not load LLM settings");
        setError(message);
        toast.error(message);
      }
    })();
  }, [vi]);

  const meta = providers.find((p) => p.id === provider);
  const selectedKey =
    settings?.keysByProvider?.[provider] ??
    (settings?.provider === provider
      ? {
          hasApiKey: settings.hasApiKey,
          apiKeyDisplay: settings.apiKeyDisplay,
        }
      : { hasApiKey: false, apiKeyDisplay: null });

  function onProviderChange(id: LlmProvider) {
    setProvider(id);
    const p = providers.find((x) => x.id === id);
    if (p) {
      setModel("");
      setBaseUrl(p.defaultBaseUrl ?? "");
    }
    setApiKeyInput("");
    setShowKeyField(false);
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
      if (!res.ok) throw new Error(json.error || (vi ? "Lưu thất bại" : "Save failed"));
      setSettings(json.settings);
      setApiKeyInput("");
      setShowKeyField(false);
      setError(null);
      toast.success(vi ? "Đã lưu cài đặt LLM (key được mã hóa trên server)" : "LLM settings saved (key encrypted on server)");
    } catch (e) {
      const message = e instanceof Error ? e.message : (vi ? "Lưu thất bại" : "Save failed");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function removeKey() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/settings/llm?provider=${encodeURIComponent(provider)}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || (vi ? "Thao tác thất bại" : "Failed"));
      setSettings(json.settings);
      setApiKeyInput("");
      setError(null);
      toast.success(vi ? "Đã xóa API key" : "API key removed");
    } catch (e) {
      const message = e instanceof Error ? e.message : (vi ? "Thao tác thất bại" : "Failed");
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
        <p className="text-sm font-medium">{vi ? "Nhà cung cấp AI và model" : "AI provider & model"}</p>
        <p className="text-xs text-muted">
          {vi ? "Chọn nhà cung cấp → model. Key được mã hóa (AES-256-GCM); giao diện chỉ hiển thị " : "Pick provider → model. Keys are encrypted (AES-256-GCM); UI only shows "}
          {settings?.apiKeyDisplay ?? "••••xxxx"}.
        </p>
      </div>

      {!settings?.encryptionReady && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {vi ? <>Thiết lập <code>APP_ENCRYPTION_SECRET</code> (≥16 ký tự) trong biến môi trường server trước khi lưu key.</> : <>Set <code>APP_ENCRYPTION_SECRET</code> (≥16 chars) in server env before saving keys.</>}
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <label className="block text-xs font-medium text-muted">{vi ? "Nhà cung cấp" : "Provider"}</label>
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

      <label className="block text-xs font-medium text-muted">
        {vi ? "Model ID chính xác" : "Exact model ID"}
      </label>
      <Input
        value={model}
        onChange={(e) => setModel(e.target.value)}
        placeholder={vi ? "Nhập đúng model ID" : "Enter exact model ID"}
        autoComplete="off"
      />

      <p className="font-mono text-[11px] text-muted">Active: {model || "—"}</p>

      {(provider === "ollama" ||
        provider === "custom" ||
        provider === "openrouter" ||
        provider === "openai" ||
        provider === "shopaikey" ||
        provider === "nvidia") && (
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
            {selectedKey.hasApiKey ? (
              <span className="font-mono text-foreground">
                {selectedKey.apiKeyDisplay}
              </span>
            ) : (
              <span className="text-muted">{vi ? "chưa có" : "none"}</span>
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
                {selectedKey.hasApiKey ? (vi ? "Thay key" : "Replace key") : (vi ? "Thêm API key" : "Add API key")}
              </Button>
              {selectedKey.hasApiKey && (
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={removeKey}
                  disabled={saving}
                >
                  {vi ? "Xóa key" : "Remove key"}
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
                {vi ? "Hủy" : "Cancel"}
              </Button>
            </div>
          )}
        </div>
      )}

      <Button onClick={save} disabled={saving || !model.trim()}>
        {saving ? (vi ? "Đang lưu…" : "Saving…") : (vi ? "Lưu cài đặt LLM" : "Save LLM settings")}
      </Button>
    </Card>
  );
}
