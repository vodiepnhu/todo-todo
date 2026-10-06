"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  Legend,
} from "recharts";

const COLORS = ["#0d9488", "#0f766e", "#14b8a6", "#5eead4", "#134e4a", "#2dd4bf"];

function Empty({ label }: { label: string }) {
  return <p className="py-8 text-center text-sm text-muted">{label}</p>;
}

export function StatusDonut({ data }: { data: { name: string; value: number }[] }) {
  if (data.every((d) => d.value === 0)) {
    return <Empty label="No items yet." />;
  }
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBar({ data }: { data: { name: string; count: number }[] }) {
  if (data.length === 0) return <Empty label="No categorized items yet." />;
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
          <Tooltip />
          <Bar dataKey="count" fill="#0d9488" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleTrend({ data }: { data: { day: string; count: number }[] }) {
  if (data.length === 0) return <Empty label="No activity in this range." />;
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="day" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
          <Tooltip />
          <Bar dataKey="count" fill="#0d9488" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeekdayBars({ data }: { data: { day: string; count: number }[] }) {
  if (data.every((d) => d.count === 0)) {
    return <Empty label="No events in this range." />;
  }
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
          <Tooltip />
          <Bar dataKey="count" fill="#14b8a6" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DurationBars({
  data,
}: {
  data: { bucket: string; estimated: number; actual: number }[];
}) {
  if (data.every((d) => d.estimated === 0 && d.actual === 0)) {
    return <Empty label="No duration data yet." />;
  }
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="estimated" fill="#0d9488" radius={[4, 4, 0, 0]} />
          <Bar dataKey="actual" fill="#5eead4" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CostBars({
  data,
}: {
  data: { category: string; estimated: number; actual: number }[];
}) {
  if (data.length === 0) return <Empty label="No plan costs yet." />;
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="category" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} width={36} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="estimated" fill="#0f766e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="actual" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PlacesScatter({
  data,
}: {
  data: { name: string; lat: number; lng: number }[];
}) {
  if (data.length === 0) {
    return <Empty label="No places with coordinates yet." />;
  }
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart>
          <XAxis type="number" dataKey="lng" name="lng" tick={{ fontSize: 10 }} />
          <YAxis type="number" dataKey="lat" name="lat" tick={{ fontSize: 10 }} width={40} />
          <ZAxis range={[60, 60]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={data} fill="#0d9488" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MemberBars({
  data,
}: {
  data: { actor: string; audits: number; events: number }[];
}) {
  if (data.length === 0) return <Empty label="No member activity yet." />;
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="actor" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="audits" fill="#0d9488" radius={[4, 4, 0, 0]} />
          <Bar dataKey="events" fill="#5eead4" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
