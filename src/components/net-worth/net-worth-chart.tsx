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

function fmtLarge(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

interface Props {
  snapshots: Snapshot[];
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
}

export function NetWorthChart({ snapshots, netWorth }: Props) {
  // Compute 1-month change: compare latest vs snapshot closest to 30 days ago
  let changeAmt = 0;
  let changePct = 0;

  if (snapshots.length >= 2) {
    const latest = snapshots[snapshots.length - 1];
    const latestDate = new Date(latest.snapshotDate).getTime();
    const thirtyDaysAgo = latestDate - 30 * 24 * 60 * 60 * 1000;

    // Find snapshot closest to 30 days ago
    let closest = snapshots[0];
    let closestDiff = Math.abs(new Date(snapshots[0].snapshotDate).getTime() - thirtyDaysAgo);
    for (const s of snapshots) {
      const diff = Math.abs(new Date(s.snapshotDate).getTime() - thirtyDaysAgo);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = s;
      }
    }

    const latestNW = parseFloat(latest.netWorth);
    const closestNW = parseFloat(closest.netWorth);
    changeAmt = latestNW - closestNW;
    changePct = closestNW !== 0 ? (changeAmt / Math.abs(closestNW)) * 100 : 0;
  }

  const isPositiveChange = changeAmt >= 0;

  const data = snapshots.map((s) => ({
    date: new Date(s.snapshotDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    netWorth: parseFloat(s.netWorth),
    assets: parseFloat(s.totalAssets),
    liabilities: parseFloat(s.totalLiabilities),
  }));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
          Net Worth
        </p>
        <div className="flex items-end gap-4 flex-wrap">
          <span className="text-4xl font-bold text-slate-900 tabular-nums">
            {fmtLarge(netWorth)}
          </span>
          {snapshots.length >= 2 && (
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-sm font-semibold px-2.5 py-1 rounded-full tabular-nums ${
                  isPositiveChange
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {isPositiveChange ? "+" : ""}
                {fmtLarge(changeAmt)} ({isPositiveChange ? "+" : ""}
                {changePct.toFixed(1)}%)
              </span>
              <span className="text-xs text-slate-400">1 month change</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      {snapshots.length < 2 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <p className="text-sm">Net worth history will appear here after 2+ snapshots</p>
          <p className="text-xs mt-1">
            Snapshots are saved automatically when you update account balances
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              width={48}
            />
            <Tooltip
              formatter={(value) => [fmtLarge(Number(value)), "Net Worth"]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontSize: "12px",
              }}
            />
            <Area
              type="monotone"
              dataKey="netWorth"
              stroke="#14b8a6"
              strokeWidth={2.5}
              fill="url(#nwGradient)"
              dot={false}
              activeDot={{ r: 4, fill: "#14b8a6" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
