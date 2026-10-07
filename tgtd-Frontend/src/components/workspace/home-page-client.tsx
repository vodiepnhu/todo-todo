"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Badge } from "@/components/ui/card";
import type { Item } from "@/types/database";
import { formatDistanceToNow } from "date-fns";
import { useLocale } from "@/lib/i18n";

export function HomePageClient({ workspaceId }: { workspaceId: string }) {
  const [activities, setActivities] = useState<Item[]>([]);
  const [recent, setRecent] = useState<{ summary: string; created_at: string }[]>(
    [],
  );
  const { locale } = useLocale();
  const vi = locale === "vi";

  async function load() {
    const supabase = createClient();
    const [{ data: items }, { data: audits }] = await Promise.all([
      supabase
        .from("items")
        .select("*")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .eq("status", "ACTIVE")
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase
        .from("audit_logs")
        .select("summary, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    setActivities((items ?? []) as Item[]);
    setRecent(audits ?? []);
  }

  useEffect(() => {
    void load();
    const onRefresh = () => void load();
    window.addEventListener("planner:refresh", onRefresh);
    return () => window.removeEventListener("planner:refresh", onRefresh);
  }, [workspaceId]);

  const hour = new Date().getHours();
  const greet = vi
    ? hour < 12 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối"
    : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const overdue = activities.filter(
    (t) => t.due_at && new Date(t.due_at) < new Date(),
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">{greet}</h2>
        <p className="text-sm text-muted">{vi ? "Tổng quan hôm nay" : "Today at a glance"}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge>{activities.length} {vi ? "đang thực hiện" : "active"}</Badge>
        {overdue > 0 && (
          <Badge className="bg-rose-100 text-rose-700">{overdue} {vi ? "quá hạn" : "overdue"}</Badge>
        )}
      </div>
      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted">
          {vi ? "Hoạt động tiếp theo" : "Next activities"}
        </h3>
        {activities.length === 0 ? (
          <Card className="text-sm text-muted">
            {vi ? "Chưa có gì. Thêm hoạt động hoặc nói với Planner: “Nhắc chúng ta đặt khách sạn trước thứ Sáu.”" : <>Nothing yet. Add something or tell Planner: &quot;Remind us to book the hotel before Friday.&quot;</>}
          </Card>
        ) : (
          activities.map((t) => (
            <Card key={t.id} className="flex items-start gap-3">
              <span className="mt-0.5 text-muted">□</span>
              <div>
                <p className="font-medium text-foreground">{t.title}</p>
                <p className="text-xs text-muted">
                  {t.due_at
                    ? new Date(t.due_at).toLocaleString()
                    : t.planned_start_at
                      ? new Date(t.planned_start_at).toLocaleString()
                      : (vi ? "Chưa có ngày" : "No date")}
                  {t.estimated_duration_min
                    ? ` · ~${t.estimated_duration_min}m`
                    : ""}
                </p>
              </div>
            </Card>
          ))
        )}
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted">
          {vi ? "Gần đây" : "Recent"}
        </h3>
        {recent.map((r, i) => (
          <p key={i} className="text-sm text-muted">
            {r.summary}{" "}
            <span className="text-xs text-muted">
              {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
            </span>
          </p>
        ))}
      </section>
    </div>
  );
}
