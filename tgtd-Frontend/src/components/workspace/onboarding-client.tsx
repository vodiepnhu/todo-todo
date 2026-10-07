"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { paths } from "@/lib/paths";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  createSharedWorkspace,
  setSharingEnabled,
} from "@/services/workspace-service";
import { LanguageSwitcher, useLocale } from "@/lib/i18n";

export function OnboardingClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [name, setName] = useState("Our Space");
  const [mode, setMode] = useState<"me" | "partner" | "family">("me");
  const [loading, setLoading] = useState(false);
  const { locale } = useLocale();
  const vi = locale === "vi";

  async function continueOnboarding() {
    setLoading(true);
    const supabase = createClient();
    if (mode === "me") {
      const { data } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("profile_id", userId)
        .is("archived_at", null)
        .limit(1)
        .maybeSingle();
      if (data) router.push(paths.project(data.workspace_id));
      else router.refresh();
      return;
    }
    try {
      const ws = await createSharedWorkspace(supabase, userId, name);
      // Ensure sharing flag is on (createSharedWorkspace already sets it)
      if (!ws.sharing_enabled) {
        await setSharingEnabled(supabase, ws.id, true);
      }
      router.push(paths.projectSettings(ws.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not create project");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-lg space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{vi ? "Chào mừng" : "Welcome"}</h1>
          <LanguageSwitcher />
        </div>
        <p className="text-sm text-muted">{vi ? "Bạn muốn dùng Planner theo cách nào?" : "How will you use Planner?"}</p>
        <div className="grid gap-2">
          {(
            [
              ["me", vi ? "Chỉ mình tôi" : "Just me"],
              ["partner", vi ? "Cùng bạn đời" : "With my partner"],
              ["family", vi ? "Cùng gia đình" : "With family"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`rounded-xl border px-4 py-3 text-left text-sm ${
                mode === key ? "border-primary bg-primary-soft" : "border-border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode !== "me" && (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={vi ? "Đặt tên dự án" : "Name your project"}
          />
        )}
        <Button className="w-full" onClick={continueOnboarding} disabled={loading}>
          {vi ? "Tiếp tục" : "Continue"}
        </Button>
      </Card>
    </div>
  );
}
