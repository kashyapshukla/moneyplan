"use client";

import { AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";

type BudgetItem = {
  category: string;
  monthlyLimit: string;
  spent: number;
  percentUsed: number;
};

function healthLabel(score: number) {
  if (score >= 80) return { text: "Excellent", color: "text-emerald-600", bg: "bg-emerald-100" };
  if (score >= 60) return { text: "Good", color: "text-blue-600", bg: "bg-blue-100" };
  if (score >= 40) return { text: "Fair", color: "text-amber-600", bg: "bg-amber-100" };
  return { text: "At Risk", color: "text-red-600", bg: "bg-red-100" };
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function BudgetHealth({
  score,
  budgets,
}: {
  score: number;
  budgets: BudgetItem[];
}) {
  const { text, color, bg } = healthLabel(score);
  const overBudget = budgets.filter((b) => b.percentUsed >= 100);
  const nearLimit = budgets.filter((b) => b.percentUsed >= 80 && b.percentUsed < 100);

  return (
    <div className="rounded-xl border bg-white dark:border-slate-700 dark:bg-slate-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-white">Budget Health</h3>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${bg} ${color}`}>
          {text}
        </span>
      </div>

      {/* Score ring */}
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
            <circle cx="32" cy="32" r="26" fill="none" stroke="#f1f5f9" strokeWidth="8" />
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke={score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444"}
              strokeWidth="8"
              strokeDasharray={`${(score / 100) * 163.4} 163.4`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-900">
            {score}
          </span>
        </div>
        <div className="flex-1 space-y-2">
          {budgets.length === 0 ? (
            <p className="text-xs text-slate-400">No budgets set yet</p>
          ) : (
            <>
              {overBudget.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {overBudget.length} over budget: {overBudget.map((b) => b.category).join(", ")}
                </div>
              )}
              {nearLimit.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                  <TrendingDown className="h-3.5 w-3.5" />
                  {nearLimit.length} near limit: {nearLimit.map((b) => b.category).join(", ")}
                </div>
              )}
              {overBudget.length === 0 && nearLimit.length === 0 && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  All budgets on track
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mini budget bars */}
      {budgets.length > 0 && (
        <div className="space-y-2 border-t dark:border-slate-700 pt-3">
          {budgets.slice(0, 4).map((b) => (
            <div key={b.category} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-300">{b.category}</span>
                <span className={b.percentUsed >= 100 ? "text-red-600" : "text-slate-400 dark:text-slate-500"}>
                  {fmt(b.spent)} / {fmt(parseFloat(b.monthlyLimit))}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    b.percentUsed >= 100 ? "bg-red-500" : b.percentUsed >= 80 ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                  style={{ width: `${Math.min(100, b.percentUsed)}%` }}
                />
              </div>
            </div>
          ))}
          {budgets.length > 4 && (
            <p className="text-xs text-slate-400 dark:text-slate-500">+{budgets.length - 4} more — see Budgets page</p>
          )}
        </div>
      )}
    </div>
  );
}
