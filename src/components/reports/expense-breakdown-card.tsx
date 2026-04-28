"use client";

import { useState } from "react";
import { X } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  Food:          "#f97316",
  Housing:       "#3b82f6",
  Transport:     "#8b5cf6",
  Health:        "#ef4444",
  Entertainment: "#ec4899",
  Shopping:      "#eab308",
  Other:         "#94a3b8",
};

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

function fmtFull(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2,
  }).format(n);
}

type Category = { name: string; avg: number; pct: number };

export function ExpenseBreakdownCard({
  avgExpenses,
  categories,
  monthCount,
}: {
  avgExpenses: number;
  categories: Category[];
  monthCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Stat card — clickable */}
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 p-5 text-left w-full hover:border-slate-300 hover:shadow-sm transition-all group"
      >
        <p className="text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wide mb-1">
          Avg Monthly Expenses
        </p>
        <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">
          {fmtFull(avgExpenses)}
        </p>
        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
          pure consumption
          <span className="text-indigo-400 group-hover:text-indigo-600 transition-colors">· tap to see breakdown →</span>
        </p>
      </button>

      {/* Breakdown panel */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Expense Breakdown</h2>
                <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
                  Average over last {monthCount} month{monthCount !== 1 ? "s" : ""} · pure consumption
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category list */}
            <div className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {categories.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No expense data found.</p>
              ) : (
                categories.map((cat) => (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: CATEGORY_COLORS[cat.name] ?? "#94a3b8" }}
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-white">{cat.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-300 tabular-nums">
                          {fmtCurrency(cat.avg)}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-400 ml-1.5 tabular-nums">
                          {cat.pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${cat.pct}%`,
                          backgroundColor: CATEGORY_COLORS[cat.name] ?? "#94a3b8",
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer total */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">Total avg / month</span>
              <span className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {fmtFull(avgExpenses)}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
