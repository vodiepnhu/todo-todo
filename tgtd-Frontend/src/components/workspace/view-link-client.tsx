"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { LanguageSwitcher, useLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import {
  getViewLinkPreview,
  listViewLinkItems,
  type ViewLinkItem,
  type ViewLinkPreview,
} from "@/services/workspace-service";

function formatDate(value: string | null, locale: "en" | "vi") {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ViewLinkClient({ token }: { token: string }) {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const [preview, setPreview] = useState<ViewLinkPreview | null>(null);
  const [items, setItems] = useState<ViewLinkItem[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const [nextPreview, nextItems] = await Promise.all([
          getViewLinkPreview(supabase, token),
          listViewLinkItems(supabase, token),
        ]);
        if (!nextPreview) {
          setError(true);
          return;
        }
        setPreview(nextPreview);
        setItems(nextItems);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [token]);

  return (
    <main className="min-h-dvh bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {vi ? "Chỉ xem" : "View only"}
            </p>
            <h1 className="text-2xl font-bold text-foreground">
              {preview?.icon ? `${preview.icon} ` : ""}
              {preview?.name ?? (vi ? "Dự án" : "Project")}
            </h1>
          </div>
          <LanguageSwitcher />
        </div>

        {loading ? (
          <Card className="p-5 text-sm text-muted">{vi ? "Đang tải…" : "Loading…"}</Card>
        ) : error ? (
          <Card className="p-5 text-sm text-danger">
            {vi ? "Liên kết không tồn tại, đã hết hạn hoặc đã bị thu hồi." : "This link is missing, expired, or revoked."}
          </Card>
        ) : (
          <>
            {preview?.description ? (
              <p className="text-sm text-muted">{preview.description}</p>
            ) : null}
            <Card className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  {vi ? "Hoạt động" : "Activities"}
                </h2>
                <span className="text-xs font-semibold text-muted">{items.length}</span>
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-muted">{vi ? "Chưa có hoạt động." : "No activities yet."}</p>
              ) : (
                <ul className="space-y-2" data-testid="view-link-items">
                  {items.map((item) => {
                    const when = formatDate(item.planned_start_at ?? item.due_at, locale);
                    return (
                      <li key={item.id} className="rounded-xl border border-border bg-surface/70 p-3">
                        <p className="font-semibold text-foreground">{item.title}</p>
                        {item.description ? <p className="mt-1 text-sm text-muted">{item.description}</p> : null}
                        {when ? <p className="mt-2 text-xs text-muted">{when}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
