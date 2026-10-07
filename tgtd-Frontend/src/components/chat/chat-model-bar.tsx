"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { LlmProvider } from "@/lib/ai/providers";
import { useLocale } from "@/lib/i18n";

type ModelOption = { id: string; label: string; tier?: string };

type Settings = {
  provider: LlmProvider;
  model: string;
  baseUrl: string | null;
  hasApiKey: boolean;
  configured: boolean;
};

type ProviderMeta = {
  id: LlmProvider;
  label: string;
  models: ModelOption[];
};

/**
 * Compact model switcher for chat composers.
 * - configured: dropdown of models for current provider + More settings
 * - not configured: More settings only (no model change)
 */
export function ChatModelBar({ settingsHref }: { settingsHref: string | null }) {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const [settings, setSettings] = useState<Settings | null>(null);
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/llm");
    if (!res.ok) return;
    const json = await res.json();
    setSettings(json.settings);
    setProviders(json.providers ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const models = useMemo(() => {
    if (!settings) return [];
    return (
      providers.find((p) => p.id === settings.provider)?.models ?? []
    );
  }, [providers, settings]);

  const modelInList = models.some((m) => m.id === settings?.model);

  async function onModelChange(modelId: string) {
    if (!settings?.configured || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider,
          model: modelId,
          baseUrl: settings.baseUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || (vi ? "Không thể cập nhật model" : "Could not update model"));
      setSettings(json.settings);
      toast.success(`${vi ? "Model" : "Model"}: ${modelId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (vi ? "Không thể cập nhật model" : "Could not update model"));
    } finally {
      setSaving(false);
    }
  }

  const moreLink = settingsHref ? (
    <Link
      href={settingsHref}
      className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
    >
      {vi ? "Cài đặt thêm" : "More settings"}
    </Link>
  ) : (
    <span className="text-xs text-muted">{vi ? "Mở dự án → Cài đặt" : "Open a project → Settings"}</span>
  );

  if (!settings) {
    return (
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>{vi ? "Đang tải model…" : "Loading model…"}</span>
        {moreLink}
      </div>
    );
  }

  if (!settings.configured) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary-soft/50 px-2.5 py-2">
        <p className="text-xs text-muted">
          {vi ? "Thiết lập nhà cung cấp và API key để chọn model." : "Set up provider &amp; API key to choose a model."}
        </p>
        {settingsHref ? (
          <Link
            href={settingsHref}
            className="rounded-lg bg-cta px-2.5 py-1 text-xs font-medium text-white hover:bg-cta-hover"
          >
            {vi ? "Cài đặt thêm" : "More settings"}
          </Link>
        ) : (
          moreLink
        )}
      </div>
    );
  }

  const providerLabel =
    providers.find((p) => p.id === settings.provider)?.label ?? settings.provider;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="chat-model-select">
        {vi ? "Model" : "Model"}
      </label>
      <select
        id="chat-model-select"
        className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-xs"
        value={modelInList ? settings.model : "__custom__"}
        disabled={saving}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__custom__") return;
          void onModelChange(v);
        }}
      >
        {!modelInList && (
          <option value="__custom__">{vi ? "Tùy chỉnh" : "Custom"}: {settings.model}</option>
        )}
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
            {m.tier ? ` · ${m.tier}` : ""}
          </option>
        ))}
      </select>
      <span className="hidden text-[10px] text-muted sm:inline">
        {providerLabel}
        {!settings.hasApiKey ? " · mock" : ""}
      </span>
      {moreLink}
    </div>
  );
}
