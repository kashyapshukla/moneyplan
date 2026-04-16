"use client";

import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface Props {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function NetWorthSummary({ totalAssets, totalLiabilities, netWorth }: Props) {
  const isPositive = netWorth >= 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-xl border bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-500">Total Assets</p>
          <div className="rounded-full bg-emerald-100 p-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold text-slate-900">{fmt(totalAssets)}</p>
      </div>

      <div className="rounded-xl border bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-500">Total Liabilities</p>
          <div className="rounded-full bg-red-100 p-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold text-slate-900">{fmt(totalLiabilities)}</p>
      </div>

      <div className={`rounded-xl border p-5 ${isPositive ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-500">Net Worth</p>
          <div className={`rounded-full p-2 ${isPositive ? "bg-emerald-100" : "bg-red-100"}`}>
            <DollarSign className={`h-4 w-4 ${isPositive ? "text-emerald-600" : "text-red-500"}`} />
          </div>
        </div>
        <p className={`mt-2 text-2xl font-bold ${isPositive ? "text-emerald-700" : "text-red-600"}`}>
          {fmt(netWorth)}
        </p>
      </div>
    </div>
  );
}
