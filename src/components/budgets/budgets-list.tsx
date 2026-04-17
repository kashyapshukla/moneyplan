"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BudgetFormDialog } from "./budget-form-dialog";
import { CATEGORY_LABELS } from "@/lib/categories";
import { useRouter } from "next/navigation";

type BudgetWithSpending = {
  id: string;
  category: string;
  monthlyLimit: string;
  month: number;
  year: number;
  spent: number;
  remaining: number;
  percentUsed: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function StatusIcon({ percent }: { percent: number }) {
  if (percent >= 100) return <AlertTriangle className="h-4 w-4 text-red-500" />;
  if (percent >= 80) return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
}

function ProgressBar({ percent }: { percent: number }) {
  const color =
    percent >= 100
      ? "bg-red-500"
      : percent >= 80
      ? "bg-amber-400"
      : "bg-emerald-400";

  return (
    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

export function BudgetsList({
  initialBudgets,
  month,
  year,
}: {
  initialBudgets: BudgetWithSpending[];
  month: number;
  year: number;
}) {
  const [budgets, setBudgets] = useState(initialBudgets);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetWithSpending | null>(null);
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("Remove this budget?")) return;
    await fetch("/api/budgets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBudgets((prev) => prev.filter((b) => b.id !== id));
    router.refresh();
  }

  function handleSaved(saved: any) {
    setBudgets((prev) => {
      const exists = prev.find((b) => b.id === saved.id || b.category === saved.category);
      if (exists) {
        return prev.map((b) =>
          b.id === saved.id || b.category === saved.category
            ? { ...b, monthlyLimit: saved.monthlyLimit, id: saved.id }
            : b
        );
      }
      return [
        ...prev,
        {
          ...saved,
          spent: 0,
          remaining: parseFloat(saved.monthlyLimit),
          percentUsed: 0,
        },
      ];
    });
    setEditing(null);
    router.refresh();
  }

  const existingCategories = budgets.map((b) => b.category);
  const allCategoriesSet = existingCategories.length >= 7; // 8 total - 1 income = 7

  const totalBudget = budgets.reduce((sum, b) => sum + parseFloat(b.monthlyLimit), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const overBudget = budgets.filter((b) => b.percentUsed >= 100);

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      {budgets.length > 0 && (
        <div className="rounded-xl border bg-white p-5 flex flex-wrap gap-6">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Total Budgeted</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{fmt(totalBudget)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Total Spent</p>
            <p className={`text-xl font-bold mt-0.5 ${totalSpent > totalBudget ? "text-red-600" : "text-slate-900"}`}>
              {fmt(totalSpent)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Remaining</p>
            <p className={`text-xl font-bold mt-0.5 ${totalBudget - totalSpent < 0 ? "text-red-600" : "text-emerald-600"}`}>
              {fmt(Math.abs(totalBudget - totalSpent))}
              {totalBudget - totalSpent < 0 && <span className="text-sm font-normal ml-1">over</span>}
            </p>
          </div>
          {overBudget.length > 0 && (
            <div className="flex items-center gap-2 ml-auto text-red-600 text-sm font-medium">
              <AlertTriangle className="h-4 w-4" />
              {overBudget.length} categor{overBudget.length > 1 ? "ies" : "y"} over budget
            </div>
          )}
        </div>
      )}

      {/* Budgets list */}
      <div className="rounded-xl border bg-slate-50 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Category Budgets</h2>
          {!allCategoriesSet && (
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" />
              Add Budget
            </Button>
          )}
        </div>

        {budgets.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <p className="text-sm">No budgets set for this month</p>
            <p className="text-xs mt-1">Click "Add Budget" to set monthly spending limits</p>
          </div>
        ) : (
          <div className="space-y-3">
            {budgets.map((b) => (
              <div key={b.id} className="rounded-lg border bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusIcon percent={b.percentUsed} />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {CATEGORY_LABELS[b.category as keyof typeof CATEGORY_LABELS] ?? b.category}
                      </p>
                      <p className="text-xs text-slate-400">
                        {fmt(b.spent)} of {fmt(parseFloat(b.monthlyLimit))}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        b.percentUsed >= 100
                          ? "text-red-600"
                          : b.percentUsed >= 80
                          ? "text-amber-500"
                          : "text-emerald-600"
                      }`}
                    >
                      {b.percentUsed >= 100
                        ? `${fmt(b.spent - parseFloat(b.monthlyLimit))} over`
                        : `${fmt(b.remaining)} left`}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(b)}
                        className="h-7 w-7 p-0"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(b.id)}
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                <ProgressBar percent={b.percentUsed} />
                <p className="text-xs text-slate-400 text-right">{b.percentUsed.toFixed(0)}% used</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <BudgetFormDialog
        open={addOpen || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setAddOpen(false);
            setEditing(null);
          }
        }}
        onSaved={handleSaved}
        initial={editing}
        month={month}
        year={year}
        existingCategories={existingCategories}
      />
    </div>
  );
}
