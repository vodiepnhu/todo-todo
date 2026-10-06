"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { paths } from "@/lib/paths";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function JoinClient({ token }: { token: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<{ name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: invite } = await supabase
        .from("workspace_invites")
        .select("workspace_id, expires_at, workspaces(name, sharing_enabled)")
        .eq("token", token)
        .is("accepted_at", null)
        .maybeSingle();
      if (!invite) {
        setError("Invite not found or expired");
        return;
      }
      if (new Date(invite.expires_at) < new Date()) {
        setError("Invite expired");
        return;
      }
      const ws = invite.workspaces as unknown as {
        name: string;
        sharing_enabled: boolean;
      };
      if (!ws?.sharing_enabled) {
        setError("Sharing is disabled for this project");
        return;
      }
      setPreview({ name: ws?.name ?? "Shared project" });
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
        <h1 className="text-2xl font-semibold">Join project</h1>
        {preview && (
          <p className="text-muted">
            You&apos;re invited to <strong className="text-foreground">{preview.name}</strong>
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button className="w-full" onClick={join} disabled={loading || !!error}>
          {loading ? "Joining…" : "Join"}
        </Button>
      </Card>
    </div>
  );
}
