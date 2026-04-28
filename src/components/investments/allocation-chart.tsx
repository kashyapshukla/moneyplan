"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#6366f1", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16"];

type Props = {
  byType: { type: string; value: number; pct: number }[];
  totalValue: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

const TYPE_LABELS: Record<string, string> = {
  equity: "Stocks",
  etf: "ETFs",
  "mutual fund": "Mutual Funds",
  "fixed income": "Bonds",
  cash: "Cash",
  derivative: "Derivatives",
  other: "Other",
};

export function AllocationChart({ byType, totalValue }: Props) {
  if (byType.length === 0) return null;

  const data = byType.map((t) => ({
    name: TYPE_LABELS[t.type] ?? t.type,
    value: t.value,
    pct: t.pct,
  }));

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Asset Allocation</h3>
      <p className="text-xs text-slate-400 mb-4">Total: {fmt(totalValue)}</p>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              dataKey="value"
              strokeWidth={2}
              stroke="transparent"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => [fmt(Number(v)), ""]}
              contentStyle={{ borderRadius: "8px", fontSize: "12px", border: "1px solid #e2e8f0" }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex-1 space-y-2">
          {data.map((entry, i) => (
            <div key={entry.name} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">{entry.name}</span>
              <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                {fmt(entry.value)}
              </span>
              <span className="text-xs text-slate-400 w-10 text-right">
                {entry.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
