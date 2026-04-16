import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDashboardData } from "@/lib/dashboard";
import { StatCard } from "@/components/dashboard/stat-card";
import { BudgetHealth } from "@/components/dashboard/budget-health";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { SpendingChart } from "@/components/dashboard/spending-chart";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const data = await getDashboardData(session.user.id);

  const netWorth = data.latestSnapshot
    ? parseFloat(data.latestSnapshot.netWorth)
    : null;

  const savingsRate =
    data.totalIncome > 0
      ? Math.max(0, ((data.totalIncome - data.totalExpenses) / data.totalIncome) * 100)
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          {MONTH_NAMES[data.month - 1]} {data.year} overview
        </p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Net Worth"
          value={netWorth !== null ? fmt(netWorth) : "—"}
          sub={netWorth !== null ? (netWorth >= 0 ? "Positive balance" : "Negative balance") : "No accounts yet"}
          icon="dollar"
          colorClass={
            netWorth === null
              ? "text-slate-400"
              : netWorth >= 0
              ? "text-emerald-600"
              : "text-red-600"
          }
        />
        <StatCard
          label="Income"
          value={fmt(data.totalIncome)}
          sub="This month"
          icon="trending_up"
          colorClass="text-emerald-600"
        />
        <StatCard
          label="Expenses"
          value={fmt(data.totalExpenses)}
          sub="This month"
          icon="trending_down"
          colorClass="text-slate-900"
        />
        <StatCard
          label="Savings Rate"
          value={savingsRate !== null ? `${savingsRate.toFixed(0)}%` : "—"}
          sub={
            savingsRate !== null
              ? savingsRate >= 20
                ? "Great job!"
                : savingsRate >= 10
                ? "On track"
                : "Room to improve"
              : "No income recorded"
          }
          icon="arrows"
          colorClass={
            savingsRate === null
              ? "text-slate-400"
              : savingsRate >= 20
              ? "text-emerald-600"
              : savingsRate >= 10
              ? "text-blue-600"
              : "text-amber-600"
          }
        />
      </div>

      {/* Middle row: spending chart + budget health */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SpendingChart spendingByCategory={data.spendingByCategory} />
        <BudgetHealth score={data.healthScore} budgets={data.budgetsWithSpending} />
      </div>

      {/* Recent transactions */}
      <RecentTransactions transactions={data.recentTxs} />
    </div>
  );
}
