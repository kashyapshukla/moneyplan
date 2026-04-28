"use client";
import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

type SpendingAlert = {
  category: string;
  currentAmount: number;
  avgAmount: number;
  pctOver: number;
  message: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function SpendingAlerts({ alerts }: { alerts: SpendingAlert[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = alerts.filter((a) => !dismissed.has(a.category));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((alert) => (
        <div
          key={alert.category}
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3"
        >
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{alert.message}</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              This month: <strong>{fmt(alert.currentAmount)}</strong> · 3-month avg: <strong>{fmt(alert.avgAmount)}</strong>
            </p>
          </div>
          <button
            onClick={() => setDismissed((prev) => new Set([...Array.from(prev), alert.category]))}
            className="text-amber-400 dark:text-amber-500 hover:text-amber-600 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
