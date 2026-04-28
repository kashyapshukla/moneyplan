"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { AccountBreakdown } from "@/lib/dashboard";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

const TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  credit: "Credit Card",
  investment: "Investment",
  loan: "Loan",
  retirement: "Retirement",
  crypto: "Crypto",
  real_estate: "Real Estate",
  vehicle: "Vehicle",
};

export function AccountBreakdown({ accounts }: { accounts: AccountBreakdown[] }) {
  const [open, setOpen] = useState(false);

  const active = accounts.filter((a) => a.income > 0 || a.expenses > 0);
  if (active.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="account-breakdown-content"
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white text-left">
            Activity by Account
          </p>
          <p className="text-xs text-slate-400 mt-0.5 text-left">
            {active.length} accounts with transactions this month
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {open && (
        <div id="account-breakdown-content" className="border-t border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-4 px-5 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Account</span>
            <span className="text-right">Income</span>
            <span className="text-right">Expenses</span>
            <span className="text-right">Net</span>
          </div>
          {active.map((acct) => (
            <div
              key={acct.accountId}
              className="grid grid-cols-4 px-5 py-3 border-t border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                  {acct.accountName}
                </p>
                <p className="text-xs text-slate-400">
                  {TYPE_LABELS[acct.accountType] ?? acct.accountType}
                </p>
              </div>
              <p className="text-sm tabular-nums text-right text-emerald-600 dark:text-emerald-400 self-center">
                {acct.income > 0 ? `+${fmt(acct.income)}` : "—"}
              </p>
              <p className="text-sm tabular-nums text-right text-red-500 dark:text-red-400 self-center">
                {acct.expenses > 0 ? `−${fmt(acct.expenses)}` : "—"}
              </p>
              <p
                className={`text-sm tabular-nums font-semibold text-right self-center ${
                  acct.net >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500 dark:text-red-400"
                }`}
              >
                {acct.net >= 0 ? "+" : ""}
                {fmt(acct.net)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
