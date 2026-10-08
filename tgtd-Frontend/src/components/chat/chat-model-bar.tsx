"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { LlmProvider } from "@/lib/ai/providers";
import { useLocale } from "@/lib/i18n";

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
      <span
        className="min-w-0 flex-1 truncate rounded-lg border border-border bg-surface px-2 py-1.5 text-xs"
        title={settings.model}
      >
        {settings.model}
      </span>
      <span className="hidden text-[10px] text-muted sm:inline">
        {providerLabel}
        {!settings.hasApiKey ? " · mock" : ""}
      </span>
      {moreLink}
    </div>
  );
}
