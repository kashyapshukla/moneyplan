"use client";
import { useState } from "react";
import { Trash2, Plus, Target, Shield, CreditCard } from "lucide-react";
import { GoalFormDialog } from "./goal-form-dialog";
import { useRouter } from "next/navigation";

type Goal = {
  id: string;
  name: string;
  type: "savings" | "debt_payoff" | "emergency_fund";
  targetAmount: number | null;
  currentAmount: number;
  monthlyContribution: number | null;
  interestRate: number;
  targetDate: string | null;
  projectedCompletionDate: string | null;
  progressPct: number;
  linkedAccountName: string | null;
  targetMonths: number | null;
};

type Account = { id: string; name: string; type: string; balance: string };

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function totalInterest(balance: number, payment: number, apr: number): number {
  if (apr === 0 || payment <= 0) return 0;
  const r = apr / 100 / 12;
  if (payment <= balance * r) return Infinity;
  const months = Math.ceil(-Math.log(1 - (balance * r) / payment) / Math.log(1 + r));
  return Math.max(0, payment * months - balance);
}

const GOAL_ICONS = {
  savings: <Target className="h-5 w-5 text-indigo-600" />,
  debt_payoff: <CreditCard className="h-5 w-5 text-red-500" />,
  emergency_fund: <Shield className="h-5 w-5 text-teal-600" />,
};

const GOAL_COLORS = {
  savings: "bg-indigo-600",
  debt_payoff: "bg-red-500",
  emergency_fund: "bg-teal-600",
};

export function GoalsList({
  initialGoals,
  accounts,
}: {
  initialGoals: Goal[];
  accounts: Account[];
}) {
  const [goals, setGoals] = useState(initialGoals);
  const [addOpen, setAddOpen] = useState(false);
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("Delete this goal?")) return;
    const previous = goals;
    setGoals((prev) => prev.filter((g) => g.id !== id));
    try {
      const res = await fetch("/api/goals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setGoals(previous);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((g) => {
          const interest =
            g.type === "debt_payoff" && g.monthlyContribution && g.targetAmount
              ? totalInterest(g.currentAmount, g.monthlyContribution, g.interestRate)
              : null;

          return (
            <div key={g.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {GOAL_ICONS[g.type]}
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{g.name}</p>
                    {g.linkedAccountName && (
                      <p className="text-xs text-slate-400 dark:text-slate-500">{g.linkedAccountName}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(g.id)}
                  className="text-slate-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {g.targetAmount != null && (
                <div>
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span>{fmt(g.currentAmount)}</span>
                    <span>{fmt(g.targetAmount)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className={`h-2 rounded-full transition-all ${GOAL_COLORS[g.type]}`}
                      style={{ width: `${g.progressPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{g.progressPct.toFixed(1)}% complete</p>
                </div>
              )}

              {g.type === "emergency_fund" && g.targetMonths && (
                <p className="text-xs text-slate-600 dark:text-slate-400">Target: {g.targetMonths} months of expenses</p>
              )}

              <div className="space-y-1">
                {g.monthlyContribution != null && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Contributing {fmt(g.monthlyContribution)}/mo</p>
                )}
                {g.type === "debt_payoff" && g.interestRate > 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {g.interestRate}% APR
                    {interest != null && isFinite(interest) && (
                      <span className="text-red-500 ml-1">· {fmt(interest)} total interest</span>
                    )}
                  </p>
                )}
                {g.projectedCompletionDate && (
                  <p className="text-xs text-emerald-600 font-medium">
                    On track for {fmtDate(g.projectedCompletionDate)}
                  </p>
                )}
                {g.targetDate && !g.projectedCompletionDate && (
                  <p className="text-xs text-amber-600">Target: {fmtDate(g.targetDate)}</p>
                )}
              </div>
            </div>
          );
        })}

        <button
          onClick={() => setAddOpen(true)}
          className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 flex flex-col items-center justify-center gap-2 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors min-h-[160px]"
        >
          <Plus className="h-6 w-6 text-slate-300 dark:text-slate-600" />
          <span className="text-sm text-slate-400 dark:text-slate-500">Add Goal</span>
        </button>
      </div>

      <GoalFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={() => { router.refresh(); }}
        accounts={accounts}
      />
    </>
  );
}
