"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Snapshot = {
  snapshotDate: string | Date;
  netWorth: string;
  totalAssets: string;
  totalLiabilities: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function NetWorthChart({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-white py-16 text-slate-400">
        <p className="text-sm">Net worth history will appear here after 2+ snapshots</p>
        <p className="text-xs mt-1">Snapshots are saved automatically when you update account balances</p>
      </div>
    );
  }

  const data = snapshots.map((s) => ({
    date: new Date(s.snapshotDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    netWorth: parseFloat(s.netWorth),
    assets: parseFloat(s.totalAssets),
    liabilities: parseFloat(s.totalLiabilities),
  }));

  return (
    <div className="rounded-xl border bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Net Worth Over Time</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value: number) => [fmt(value), "Net Worth"]}
            contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
          />
          <Area
            type="monotone"
            dataKey="netWorth"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#netWorthGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
