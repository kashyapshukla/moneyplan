"use client";

import { useState } from "react";
import { AccountType } from "@/lib/account-types";

const ACCOUNT_GROUPS = [
  {
    key: "cash",
    label: "Cash",
    types: ["checking", "savings"] as AccountType[],
    color: "#14b8a6",
    isLiability: false,
  },
  {
    key: "investment",
    label: "Investments",
    types: ["investment", "retirement", "crypto"] as AccountType[],
    color: "#06b6d4",
    isLiability: false,
  },
  {
    key: "real_estate",
    label: "Real Estate",
    types: ["real_estate"] as AccountType[],
    color: "#8b5cf6",
    isLiability: false,
  },
  {
    key: "vehicle",
    label: "Vehicles",
    types: ["vehicle"] as AccountType[],
    color: "#f97316",
    isLiability: false,
  },
  {
    key: "credit",
    label: "Credit Cards",
    types: ["credit"] as AccountType[],
    color: "#ef4444",
    isLiability: true,
  },
  {
    key: "loan",
    label: "Loans",
    types: ["loan"] as AccountType[],
    color: "#f59e0b",
    isLiability: true,
  },
];

interface Props {
  accounts: { type: AccountType; balance: string }[];
}

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtFull(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number, total: number) {
  if (total === 0) return "0%";
  return `${((n / total) * 100).toFixed(1)}%`;
}

export function NetWorthSummary({ accounts }: Props) {
  const [mode, setMode] = useState<"totals" | "percent">("totals");

  // Compute totals per group
  const groupTotals = ACCOUNT_GROUPS.map((g) => {
    const total = accounts
      .filter((a) => g.types.includes(a.type))
      .reduce((sum, a) => sum + Math.abs(parseFloat(a.balance)), 0);
    return { ...g, total };
  });

  const assetGroups = groupTotals.filter((g) => !g.isLiability && g.total > 0);
  const liabilityGroups = groupTotals.filter((g) => g.isLiability && g.total > 0);

  const totalAssets = assetGroups.reduce((s, g) => s + g.total, 0);
  const totalLiabilities = liabilityGroups.reduce((s, g) => s + g.total, 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
      {/* Header + toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Summary</h2>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          <button
            type="button"
            className={`px-3 py-1 font-medium transition-colors ${
              mode === "totals"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setMode("totals")}
          >
            Totals
          </button>
          <button
            type="button"
            className={`px-3 py-1 font-medium transition-colors ${
              mode === "percent"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setMode("percent")}
          >
            Percent
          </button>
        </div>
      </div>

      {/* Assets */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Assets
          </span>
          <span className="text-sm font-bold text-slate-900 tabular-nums">
            {fmtCompact(totalAssets)}
          </span>
        </div>

        {/* Segmented progress bar */}
        {totalAssets > 0 && assetGroups.length > 0 && (
          <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
            {assetGroups.map((g) => (
              <div
                key={g.key}
                style={{
                  width: `${(g.total / totalAssets) * 100}%`,
                  backgroundColor: g.color,
                }}
              />
            ))}
          </div>
        )}

        {/* Asset list */}
        <div className="space-y-1.5 pt-1">
          {assetGroups.length === 0 && (
            <p className="text-xs text-slate-400 italic">No assets added yet</p>
          )}
          {assetGroups.map((g) => (
            <div key={g.key} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: g.color }}
              />
              <span className="text-xs text-slate-600 flex-1">{g.label}</span>
              <span className="text-xs font-semibold text-slate-800 tabular-nums">
                {mode === "totals" ? fmtFull(g.total) : fmtPct(g.total, totalAssets)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100" />

      {/* Liabilities */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Liabilities
          </span>
          <span className="text-sm font-bold text-red-600 tabular-nums">
            {fmtCompact(totalLiabilities)}
          </span>
        </div>

        {/* Segmented progress bar */}
        {totalLiabilities > 0 && liabilityGroups.length > 0 && (
          <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
            {liabilityGroups.map((g) => (
              <div
                key={g.key}
                style={{
                  width: `${(g.total / totalLiabilities) * 100}%`,
                  backgroundColor: g.color,
                }}
              />
            ))}
          </div>
        )}

        {/* Liability list */}
        <div className="space-y-1.5 pt-1">
          {liabilityGroups.length === 0 && (
            <p className="text-xs text-slate-400 italic">No liabilities added yet</p>
          )}
          {liabilityGroups.map((g) => (
            <div key={g.key} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: g.color }}
              />
              <span className="text-xs text-slate-600 flex-1">{g.label}</span>
              <span className="text-xs font-semibold text-red-600 tabular-nums">
                {mode === "totals" ? fmtFull(g.total) : fmtPct(g.total, totalLiabilities)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Net worth line */}
      <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Net Worth</span>
        <span
          className={`text-sm font-bold tabular-nums ${
            totalAssets - totalLiabilities >= 0 ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {fmtFull(totalAssets - totalLiabilities)}
        </span>
      </div>
    </div>
  );
}
