"use client";

import {
  BarChart,
  Bar,
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
  income: number;
  expenses: number;
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

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const isForecast = payload[0]?.payload?.forecast;
  return (
    <div className="bg-white border rounded-lg p-3 shadow text-xs space-y-1.5">
      <p className="font-semibold text-slate-700">
        {label} {isForecast && <span className="text-slate-400 font-normal">(forecast)</span>}
      </p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.fill || p.color }} />
          <span className="text-slate-500 capitalize">{p.name}:</span>
          <span className="font-medium text-slate-800">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function IncomeExpenseChart({ data }: { data: DataPoint[] }) {
  if (data.every((d) => d.income === 0 && d.expenses === 0)) {
    return (
      <div className="rounded-xl border bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Income vs Expenses</h3>
        <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
          No transaction data yet
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Income vs Expenses</h3>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-300 inline-block"/>Forecast</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="square"
            iconSize={8}
            formatter={(value) => <span style={{ fontSize: "11px", color: "#64748b", textTransform: "capitalize" }}>{value}</span>}
          />
          <Bar dataKey="income" name="income" fill="#10b981" radius={[3, 3, 0, 0]}
            fillOpacity={undefined}
            className="[&_.recharts-bar-rectangle[data-forecast='true']]:fill-emerald-200"
          />
          <Bar dataKey="expenses" name="expenses" fill="#f97316" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
