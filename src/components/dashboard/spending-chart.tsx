"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useTheme } from "@/lib/theme";

const COLORS = [
  "#f97316", // Food - orange
  "#3b82f6", // Housing - blue
  "#8b5cf6", // Transport - purple
  "#ef4444", // Health - red
  "#ec4899", // Entertainment - pink
  "#eab308", // Shopping - yellow
  "#10b981", // Income - green
  "#94a3b8", // Other - slate
];

const CATEGORY_ORDER = ["Food", "Housing", "Transport", "Health", "Entertainment", "Shopping", "Other"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function SpendingChart({ spendingByCategory }: { spendingByCategory: Record<string, number> }) {
  const { resolvedTheme } = useTheme();
  const tooltipStyle = {
    borderRadius: "8px",
    fontSize: "12px",
    border: `1px solid ${resolvedTheme === "dark" ? "#334155" : "#e2e8f0"}`,
    backgroundColor: resolvedTheme === "dark" ? "#1e293b" : "#ffffff",
    color: resolvedTheme === "dark" ? "#f1f5f9" : "#0f172a",
  };

  const data = CATEGORY_ORDER
    .filter((cat) => (spendingByCategory[cat] ?? 0) > 0)
    .map((cat, i) => ({
      name: cat,
      value: spendingByCategory[cat],
      color: COLORS[i % COLORS.length],
    }));

  if (data.length === 0) {
    return (
      <div className="rounded-xl border bg-white dark:border-slate-700 dark:bg-slate-900 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-white mb-4">Spending by Category</h3>
        <div className="flex items-center justify-center py-10 text-slate-400 dark:text-slate-400 text-sm">
          No spending data for this month
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white dark:border-slate-700 dark:bg-slate-900 p-5">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-white mb-4">Spending by Category</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [fmt(Number(value)), "Spent"]}
            contentStyle={tooltipStyle}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span style={{ fontSize: "11px", color: "#64748b" }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
