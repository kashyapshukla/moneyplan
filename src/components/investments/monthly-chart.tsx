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
import type { MonthlyInvestment } from "@/lib/investments";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtShort(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

type Props = {
  data: MonthlyInvestment[];
  currentMonth: string;
};

export function MonthlyInvestmentChart({ data, currentMonth }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => v.split(" ")[0]} // show just "Jan", "Feb" etc.
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmtShort}
          width={48}
        />
        <Tooltip
          formatter={(v) => [fmt(Number(v ?? 0)), "Invested"]}
          labelFormatter={(label) => String(label)}
          contentStyle={{
            borderRadius: "8px",
            fontSize: "12px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
        />
        <Bar dataKey="invested" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.month}
              fill={entry.month === currentMonth ? "#6366f1" : "#a5b4fc"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
