"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type MonthlyReport = {
  label: string;
  byCategory: Record<string, number>;
};

const COLORS: Record<string, string> = {
  Food: "#f97316",
  Housing: "#3b82f6",
  Transport: "#8b5cf6",
  Health: "#ef4444",
  Entertainment: "#ec4899",
  Shopping: "#eab308",
  Other: "#94a3b8",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function CategoryBreakdown({ reports }: { reports: MonthlyReport[] }) {
  // Aggregate spending by category across all months
  const totals: Record<string, number> = {};
  for (const report of reports) {
    for (const [cat, amt] of Object.entries(report.byCategory)) {
      totals[cat] = (totals[cat] ?? 0) + amt;
    }
  }

  const data = Object.entries(totals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([category, total]) => ({ category, total }));

  if (data.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Spending by Category</h3>
        <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
          No spending data yet
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        Spending by Category{" "}
        <span className="text-slate-400 font-normal text-xs">(last {reports.length} months)</span>
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
          <YAxis
            type="category"
            dataKey="category"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            formatter={(v: number) => [fmt(v), "Total"]}
            contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
          />
          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.category} fill={COLORS[entry.category] ?? "#94a3b8"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
