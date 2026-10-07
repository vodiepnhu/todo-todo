"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AuditLog } from "@/types/database";
import { format } from "date-fns";
import { useLocale } from "@/lib/i18n";

export function ActivityChart({ audits }: { audits: AuditLog[] }) {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const buckets = new Map<string, number>();
  for (const a of audits) {
    const key = format(new Date(a.created_at), "MMM d");
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  const data = Array.from(buckets.entries()).map(([day, count]) => ({
    day,
    count,
  }));

  if (data.length === 0) {
    return <p className="text-sm text-muted">{vi ? "Chưa có hoạt động trong khoảng này." : "No activity in this range."}</p>;
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
          <Tooltip />
          <Bar dataKey="count" fill="#0d9488" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
