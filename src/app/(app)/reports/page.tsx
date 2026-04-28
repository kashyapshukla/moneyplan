import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMonthlyReports, getForecast } from "@/lib/reports";
import { IncomeExpenseChart } from "@/components/reports/income-expense-chart";
import { SavingsTrend } from "@/components/reports/savings-trend";
import { CategoryBreakdown } from "@/components/reports/category-breakdown";
import { CashFlowSection } from "@/components/reports/cash-flow-section";
import { IncomeSourceSelector } from "@/components/settings/income-source-selector";
import { ExpenseBreakdownCard } from "@/components/reports/expense-breakdown-card";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const EXCLUDE_FROM_CONSUMPTION = new Set(["Investment", "Savings", "Transfer", "Income"]);

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const reports = await getMonthlyReports(session.user.id, 6);
  const forecast = await getForecast(reports, 3);

  // Combine actuals + forecast for charts
  const incomeExpenseData = [
    ...reports.map((r) => ({
      label:    r.label,
      income:   r.income,
      expenses: r.expenses,  // pure consumption
      saved:    r.saved,
      invested: r.invested,
      savings:  r.savings,
    })),
    ...forecast,
  ];

  // Averages from last 3 months
  const last3 = reports.slice(-3);
  const avgIncome    = last3.reduce((s, r) => s + r.income,   0) / (last3.length || 1);
  const avgExpenses  = last3.reduce((s, r) => s + r.expenses, 0) / (last3.length || 1); // pure consumption
  const avgSaved     = last3.reduce((s, r) => s + r.saved,    0) / (last3.length || 1);
  const avgInvested  = last3.reduce((s, r) => s + r.invested, 0) / (last3.length || 1);
  const avgSavingsRate =
    avgIncome > 0 ? ((avgSaved + avgInvested) / avgIncome) * 100 : 0;

  const projectedAnnualSavings =
    forecast.length > 0
      ? forecast.reduce((s, f) => s + f.savings, 0) / forecast.length * 12
      : 0;

  // Category breakdown for the expense card (avg over last3, consumption only)
  const catTotals: Record<string, number> = {};
  for (const r of last3) {
    for (const [cat, amt] of Object.entries(r.byCategory)) {
      if (EXCLUDE_FROM_CONSUMPTION.has(cat)) continue;
      catTotals[cat] = (catTotals[cat] ?? 0) + amt;
    }
  }
  const expenseCategories = Object.entries(catTotals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, total]) => ({
      name,
      avg: total / (last3.length || 1),
      pct: avgExpenses > 0 ? (total / (last3.length || 1) / avgExpenses) * 100 : 0,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          6-month history + 3-month spending forecast
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Income */}
        <div className="rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 p-5">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wide mb-1">Avg Monthly Income</p>
          <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(avgIncome)}</p>
        </div>

        {/* Expenses — clickable breakdown */}
        <ExpenseBreakdownCard
          avgExpenses={avgExpenses}
          categories={expenseCategories}
          monthCount={last3.length}
        />

        {/* Saved / Invested */}
        <div className="rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 p-5">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wide mb-1">Avg Saved / Invested</p>
          <p className={`text-xl font-bold tabular-nums ${avgSavingsRate >= 20 ? "text-teal-600" : avgSavingsRate >= 10 ? "text-indigo-600 dark:text-blue-400" : "text-amber-600"}`}>
            {fmt(avgSaved)} / {fmt(avgInvested)}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">{avgSavingsRate.toFixed(1)}% of income</p>
        </div>

        {/* Projected annual savings */}
        <div className="rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 p-5">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wide mb-1">Projected Annual Savings</p>
          <p className={`text-xl font-bold tabular-nums ${projectedAnnualSavings >= 0 ? "text-indigo-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}`}>
            {fmt(projectedAnnualSavings)}
          </p>
        </div>
      </div>

      {/* Income Source Selector */}
      <IncomeSourceSelector />

      {/* Cash Flow Sankey */}
      <CashFlowSection />

      {/* Charts */}
      <IncomeExpenseChart data={incomeExpenseData} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SavingsTrend data={incomeExpenseData} />
        <CategoryBreakdown reports={reports} />
      </div>
    </div>
  );
}
