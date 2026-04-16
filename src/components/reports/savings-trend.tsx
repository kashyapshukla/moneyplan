"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

type DataPoint = {
  label: string;
  savings: number;
  forecast?: boolean;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function SavingsTrend({ data }: { data: DataPoint[] }) {
  const hasSavings = data.some((d) => d.savings !== 0);

  if (!hasSavings) {
    return (
      <div className="rounded-xl border bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Savings Trend & Forecast</h3>
        <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
          No data to forecast yet
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Savings Trend & 3-Month Forecast</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
          <ReferenceLine y={0} stroke="#e2e8f0" strokeDasharray="4 4" />
          <Tooltip
            formatter={(value: number, name: string, props: any) => [
              fmt(value),
              props.payload?.forecast ? "Projected Savings" : "Savings",
            ]}
            contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
          />
          <Area
            type="monotone"
            dataKey="savings"
            stroke="#6366f1"
            strokeWidth={2}
            strokeDasharray="0"
            fill="url(#savingsGradient)"
            dot={(props: any) => {
              const isForecast = props.payload?.forecast;
              return (
                <circle
                  key={props.key}
                  cx={props.cx}
                  cy={props.cy}
                  r={4}
                  fill={isForecast ? "white" : "#6366f1"}
                  stroke="#6366f1"
                  strokeWidth={2}
                  strokeDasharray={isForecast ? "4 2" : "0"}
                />
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-400 mt-2 text-center">
        Dashed dots = forecasted months based on your recent trend
      </p>
    </div>
  );
}
