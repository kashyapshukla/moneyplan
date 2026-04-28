import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listBudgetsWithSpending, getTopTransactionsByCategory, copyBudgetsFromLastMonth } from "@/lib/budgets";
import { BudgetsList } from "@/components/budgets/budgets-list";
import { MonthNav } from "@/components/budgets/month-nav";
import { OnboardingBanner } from "@/components/budgets/onboarding-banner";
import { SpendingAlerts } from "@/components/dashboard/spending-alerts";
import { getSpendingAlerts } from "@/lib/alerts";
import type { CategoryTransaction } from "@/lib/budgets";

export type EnrichedBudget = {
  id: string;
  category: string;
  monthlyLimit: string;
  month: number;
  year: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  projectedRecurring: number;
  // enriched
  dailyAllowance: number;
  velocity: "fast" | "normal" | "slow" | "none";
  topMerchant: string | null;
  topMerchantAmount: number;
};

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const now = new Date();
  const month = parseInt(searchParams.month ?? String(now.getMonth() + 1));
  const year = parseInt(searchParams.year ?? String(now.getFullYear()));

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth;
  const daysLeft = isCurrentMonth ? daysInMonth - now.getDate() : 0;

  const [topTxByCategory, alerts] = await Promise.all([
    getTopTransactionsByCategory(session.user.id, month, year, 5),
    getSpendingAlerts(session.user.id),
  ]);
  let budgets = await listBudgetsWithSpending(session.user.id, month, year);

  // Auto-copy budgets from last month if this month has none (carry-forward)
  if (budgets.length === 0) {
    const copied = await copyBudgetsFromLastMonth(session.user.id, month, year);
    if (copied > 0) {
      // Reload budgets after copying
      budgets = await listBudgetsWithSpending(session.user.id, month, year);
    }
  }

  // Enrich each budget with velocity + daily allowance
  const enriched: EnrichedBudget[] = budgets.map((b) => {
    const limit = parseFloat(b.monthlyLimit);
    const dailyAllowance = daysLeft > 0 ? b.remaining / daysLeft : 0;

    // Velocity: compare % of budget used vs % of month elapsed
    const monthPctElapsed = daysInMonth > 0 ? daysElapsed / daysInMonth : 1;
    const budgetPctUsed = limit > 0 ? b.spent / limit : 0;
    let velocity: "fast" | "normal" | "slow" | "none" = "none";
    if (b.spent > 0 && isCurrentMonth) {
      if (budgetPctUsed > monthPctElapsed + 0.15)      velocity = "fast";
      else if (budgetPctUsed < monthPctElapsed - 0.15) velocity = "slow";
      else                                              velocity = "normal";
    }

    const txList: CategoryTransaction[] = topTxByCategory[b.category] ?? [];
    const topTx = txList[0] ?? null;
    const topMerchant = topTx ? topTx.description : null;
    const topMerchantAmount = topTx ? Math.abs(parseFloat(topTx.amount)) : 0;

    return {
      ...b,
      dailyAllowance,
      velocity,
      topMerchant,
      topMerchantAmount,
    };
  });

  const monthName = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Budgets</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Set monthly limits per category</p>
        </div>
        <MonthNav month={month} year={year} />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{monthName}</span>
        {isCurrentMonth && (
          <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-full px-2 py-0.5 font-medium">
            Current Month
          </span>
        )}
      </div>

      {budgets.length === 0 && <OnboardingBanner month={month} year={year} />}

      <SpendingAlerts alerts={alerts} />

      <BudgetsList
        enrichedBudgets={enriched}
        topTxByCategory={topTxByCategory}
        month={month}
        year={year}
        isCurrentMonth={isCurrentMonth}
        daysInMonth={daysInMonth}
        daysLeft={daysLeft}
        daysElapsed={daysElapsed}
      />
    </div>
  );
}
