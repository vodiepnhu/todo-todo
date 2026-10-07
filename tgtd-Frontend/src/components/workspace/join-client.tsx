"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { paths } from "@/lib/paths";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LanguageSwitcher, useLocale } from "@/lib/i18n";

export function JoinClient({ token }: { token: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<{ name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { locale } = useLocale();
  const vi = locale === "vi";

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: invite } = await supabase.rpc("preview_workspace_invite", {
        invite_token: token,
      });
      if (!invite) {
        setError("Invite not found or expired");
        return;
      }
      const preview = Array.isArray(invite) ? invite[0] : invite;
      if (!preview || new Date(preview.expires_at) < new Date()) {
        setError("Invite expired");
        return;
      }
      if (!preview.sharing_enabled) {
        setError("Sharing is disabled for this project");
        return;
      }
      setPreview({ name: preview.name ?? "Shared project" });
    }
    void load();
  }, [token]);

  async function join() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/login?next=/join/${token}`);
        return;
      }
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Join failed");
      router.push(paths.project(json.workspaceId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Join failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-md space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{vi ? "Tham gia dự án" : "Join project"}</h1>
          <LanguageSwitcher />
        </div>
        {preview && (
          <p className="text-muted">
            {vi ? "Bạn được mời tham gia " : "You&apos;re invited to "}<strong className="text-foreground">{preview.name}</strong>
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button className="w-full" onClick={join} disabled={loading || !!error}>
          {loading ? (vi ? "Đang tham gia…" : "Joining…") : (vi ? "Tham gia" : "Join")}
        </Button>
      </Card>
    </div>
  );
}
