import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMonthlyReports, getForecast } from "@/lib/reports";
import { IncomeExpenseChart } from "@/components/reports/income-expense-chart";
import { SavingsTrend } from "@/components/reports/savings-trend";
import { CategoryBreakdown } from "@/components/reports/category-breakdown";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const reports = await getMonthlyReports(session.user.id, 6);
  const forecast = await getForecast(reports, 3);

  // Combine actuals + forecast for charts
  const incomeExpenseData = [
    ...reports.map((r) => ({
      label: r.label,
      income: r.income,
      expenses: r.expenses,
      savings: r.savings,
    })),
    ...forecast,
  ];

  // Averages from last 3 months
  const last3 = reports.slice(-3);
  const avgIncome = last3.reduce((s, r) => s + r.income, 0) / (last3.length || 1);
  const avgExpenses = last3.reduce((s, r) => s + r.expenses, 0) / (last3.length || 1);
  const avgSavingsRate =
    avgIncome > 0 ? ((avgIncome - avgExpenses) / avgIncome) * 100 : 0;

  const projectedAnnualSavings =
    forecast.length > 0
      ? forecast.reduce((s, f) => s + f.savings, 0) / forecast.length * 12
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-1">
          6-month history + 3-month spending forecast
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Avg Monthly Income",
            value: fmt(avgIncome),
            color: "text-emerald-600",
          },
          {
            label: "Avg Monthly Expenses",
            value: fmt(avgExpenses),
            color: "text-slate-900",
          },
          {
            label: "Avg Savings Rate",
            value: `${avgSavingsRate.toFixed(1)}%`,
            color: avgSavingsRate >= 20 ? "text-emerald-600" : avgSavingsRate >= 10 ? "text-blue-600" : "text-amber-600",
          },
          {
            label: "Projected Annual Savings",
            value: fmt(projectedAnnualSavings),
            color: projectedAnnualSavings >= 0 ? "text-indigo-600" : "text-red-600",
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-white p-5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
              {stat.label}
            </p>
            <p className={`text-xl font-bold tabular-nums ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <IncomeExpenseChart data={incomeExpenseData} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SavingsTrend data={incomeExpenseData} />
        <CategoryBreakdown reports={reports} />
      </div>
    </div>
  );
}
