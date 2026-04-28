"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Tx = {
  id: string;
  description: string;
  amount: string;
  date: Date | string;
  category: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  Food: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  Housing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Transport: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  Health: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  Entertainment: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  Shopping: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  Income: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  Other: "bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300",
};

function fmt(amount: string) {
  const n = parseFloat(amount);
  const abs = Math.abs(n);
  const str = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(abs);
  return { str, isNegative: n < 0 };
}

export function RecentTransactions({ transactions }: { transactions: Tx[] }) {
  return (
    <div className="rounded-xl border bg-white dark:border-slate-700 dark:bg-slate-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-white">Recent Transactions</h3>
        <Link
          href="/transactions"
          className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <p className="text-sm">No transactions yet</p>
          <Link href="/transactions" className="text-xs text-blue-500 hover:underline mt-1 block">
            Add your first transaction
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => {
            const { str, isNegative } = fmt(tx.amount);
            return (
              <div key={tx.id} className="flex items-center gap-3 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 -mx-1 px-1 rounded-lg transition-colors border-b border-transparent dark:border-slate-800 last:border-0">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                    CATEGORY_COLORS[tx.category] ?? "bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300"
                  }`}
                >
                  {tx.category}
                </span>
                <p className="text-sm text-slate-700 dark:text-slate-200 truncate flex-1">{tx.description}</p>
                <span
                  className={`text-sm font-semibold tabular-nums flex-shrink-0 ${
                    isNegative ? "text-slate-900 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {isNegative ? "-" : "+"}{str}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
