import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMonthlyInvestmentActivity } from "@/lib/investments";
import { MonthlyInvestmentChart } from "@/components/investments/monthly-chart";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function InvestmentActivityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const data = await getMonthlyInvestmentActivity(session.user.id, 12);

  const now = new Date();
  const currentMonthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  const prevMonthLabel = `${MONTH_NAMES[now.getMonth() === 0 ? 11 : now.getMonth() - 1]} ${now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}`;

  const currentMonth = data.find((d) => d.month === currentMonthLabel);
  const prevMonth = data.find((d) => d.month === prevMonthLabel);

  const thisMonthTotal = currentMonth?.invested ?? 0;
  const lastMonthTotal = prevMonth?.invested ?? 0;
  const totalYear = data.reduce((s, d) => s + d.invested, 0);
  const avgMonth = data.filter((d) => d.invested > 0).length > 0
    ? totalYear / data.filter((d) => d.invested > 0).length
    : 0;

  const diff = thisMonthTotal - lastMonthTotal;
  const diffPct = lastMonthTotal > 0 ? (diff / lastMonthTotal) * 100 : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Investment Activity</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Monthly contributions to your investment accounts — last 12 months
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* This Month */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">This Month</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{fmt(thisMonthTotal)}</p>
          {diffPct !== null && (
            <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${
              diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
            }`}>
              {diff > 0 ? <TrendingUp className="h-3.5 w-3.5" /> :
               diff < 0 ? <TrendingDown className="h-3.5 w-3.5" /> :
               <Minus className="h-3.5 w-3.5" />}
              {diff >= 0 ? "+" : ""}{diffPct.toFixed(1)}% vs last month
            </div>
          )}
          {diffPct === null && lastMonthTotal === 0 && (
            <p className="text-xs text-slate-400 mt-1">No data last month</p>
          )}
        </div>

        {/* Last Month */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Month</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{fmt(lastMonthTotal)}</p>
          <p className="text-xs text-slate-400 mt-1">{prevMonthLabel}</p>
        </div>

        {/* Monthly Average */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Monthly Avg</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{fmt(avgMonth)}</p>
          <p className="text-xs text-slate-400 mt-1">{fmt(totalYear)} total this year</p>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Monthly Contributions</h3>
            <p className="text-xs text-slate-400 mt-0.5">Amount invested per month into Robinhood, Vanguard, etc.</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500 inline-block" />
              Current month
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-indigo-300 inline-block" />
              Previous months
            </span>
          </div>
        </div>

        {data.every((d) => d.invested === 0) ? (
          <div className="h-[280px] flex items-center justify-center">
            <div className="text-center max-w-sm mx-auto">
              <p className="text-slate-400 text-sm font-medium">No investment activity found yet.</p>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                This chart shows transfers from your bank accounts to Robinhood, Vanguard, etc.
                Make sure your checking/savings accounts are synced and have recent transactions.
              </p>
            </div>
          </div>
        ) : (
          <MonthlyInvestmentChart data={data} currentMonth={currentMonthLabel} />
        )}
      </div>

      {/* Monthly Breakdown Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Month-by-Month Breakdown</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Month</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Invested</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">vs Avg</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((row) => {
              const vsAvg = avgMonth > 0 ? ((row.invested - avgMonth) / avgMonth) * 100 : null;
              const isCurrentMonth = row.month === currentMonthLabel;
              return (
                <tr
                  key={row.month}
                  className={`border-b border-slate-50 dark:border-slate-800 last:border-0 ${
                    isCurrentMonth ? "bg-indigo-50 dark:bg-indigo-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                  } transition-colors`}
                >
                  <td className="px-5 py-3">
                    <span className={`font-medium ${isCurrentMonth ? "text-indigo-700 dark:text-indigo-300" : "text-slate-800 dark:text-slate-200"}`}>
                      {row.month}
                    </span>
                    {isCurrentMonth && (
                      <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded-full">
                        current
                      </span>
                    )}
                  </td>
                  <td className={`px-5 py-3 text-right tabular-nums font-semibold ${
                    row.invested > 0 ? "text-slate-900 dark:text-white" : "text-slate-400"
                  }`}>
                    {row.invested > 0 ? fmt(row.invested) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-xs">
                    {vsAvg !== null && row.invested > 0 ? (
                      <span className={vsAvg >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}>
                        {vsAvg >= 0 ? "+" : ""}{vsAvg.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
