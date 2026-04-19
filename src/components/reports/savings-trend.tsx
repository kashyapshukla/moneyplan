"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

type DataPoint = {
  label: string;
  saved?: number;
  invested?: number;
  savings?: number;   // legacy fallback
  forecast?: boolean;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const isForecast = payload[0]?.payload?.forecast;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-sm">
      <p className="font-semibold text-slate-700 mb-1.5">
        {label}{isForecast ? " (forecast)" : ""}
      </p>
      {payload.map((entry: { name: string; value: number; color: string }) => (
        <div key={entry.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500 capitalize">{entry.name}:</span>
          <span className="font-bold text-slate-800">{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function SavingsTrend({ data }: { data: DataPoint[] }) {
  const hasData = data.some((d) => (d.saved ?? 0) + (d.invested ?? 0) + (d.savings ?? 0) !== 0);

  if (!hasData) {
    return (
      <div className="rounded-xl border bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Savings & Investment Trend</h3>
        <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
          No savings or investment data yet
        </div>
      </div>
    );
  }

  // Normalise: older data might only have `savings`; split it as all-savings, no invested
  const chartData = data.map((d) => ({
    ...d,
    saved:    d.saved    ?? d.savings ?? 0,
    invested: d.invested ?? 0,
  }));

  return (
    <div className="rounded-xl border bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        Savings &amp; Investment Trend
        <span className="ml-2 text-xs font-normal text-slate-400">+ 3-month forecast</span>
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="savedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#14b8a6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="investedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
          <ReferenceLine y={0} stroke="#e2e8f0" strokeDasharray="4 4" />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
          />

          {/* Savings area */}
          <Area
            type="monotone"
            dataKey="saved"
            name="Savings"
            stroke="#14b8a6"
            strokeWidth={2}
            fill="url(#savedGradient)"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dot={(props: any) => (
              <circle
                key={props.key}
                cx={props.cx} cy={props.cy} r={3}
                fill={props.payload?.forecast ? "white" : "#14b8a6"}
                stroke="#14b8a6" strokeWidth={2}
                strokeDasharray={props.payload?.forecast ? "4 2" : "0"}
              />
            )}
          />

          {/* Investment area */}
          <Area
            type="monotone"
            dataKey="invested"
            name="Investment"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#investedGradient)"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dot={(props: any) => (
              <circle
                key={props.key}
                cx={props.cx} cy={props.cy} r={3}
                fill={props.payload?.forecast ? "white" : "#6366f1"}
                stroke="#6366f1" strokeWidth={2}
                strokeDasharray={props.payload?.forecast ? "4 2" : "0"}
              />
            )}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-400 mt-2 text-center">
        Dashed dots = forecasted months · Teal = Savings · Indigo = Investment
      </p>
    </div>
  );
}
