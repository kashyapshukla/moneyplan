import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listGoals, getMonthlySpendingAvg } from "@/lib/goals";
import { listAccounts } from "@/lib/accounts";
import { GoalsList } from "@/components/goals/goals-list";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

export default async function GoalsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const [goals, accounts, monthlySpend] = await Promise.all([
    listGoals(session.user.id),
    listAccounts(session.user.id),
    getMonthlySpendingAvg(session.user.id),
  ]);

  // For emergency_fund goals: compute target from monthlySpend * targetMonths
  const enriched = goals.map((g) => {
    if (g.type === "emergency_fund" && g.targetMonths && monthlySpend > 0) {
      const target = monthlySpend * g.targetMonths;
      return {
        ...g,
        targetAmount: target,
        progressPct: Math.min(100, (g.currentAmount / target) * 100),
      };
    }
    return g;
  });

  const totalTargeted = enriched.reduce((s, g) => s + (g.targetAmount ?? 0), 0);
  const totalProgress = enriched.reduce((s, g) => s + g.currentAmount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Financial Goals</h1>
        <p className="text-sm text-slate-500 mt-1">
          {goals.length} goal{goals.length !== 1 ? "s" : ""} · {fmt(totalProgress)} saved toward{" "}
          {fmt(totalTargeted)} total
        </p>
      </div>

      {monthlySpend > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-600">
          Avg monthly spending: <strong>{fmt(monthlySpend)}</strong> · 6-month emergency fund target:{" "}
          <strong>{fmt(monthlySpend * 6)}</strong>
        </div>
      )}

      <GoalsList
        initialGoals={enriched.map((g) => ({
          id: g.id,
          name: g.name,
          type: g.type,
          targetAmount: g.targetAmount,
          currentAmount: g.currentAmount,
          monthlyContribution: g.monthlyContribution,
          interestRate: g.interestRate,
          targetDate: g.targetDate?.toISOString() ?? null,
          projectedCompletionDate: g.projectedCompletionDate?.toISOString() ?? null,
          progressPct: g.progressPct,
          linkedAccountName: g.linkedAccountName,
          targetMonths: g.targetMonths,
        }))}
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          balance: a.balance,
        }))}
      />
    </div>
  );
}
