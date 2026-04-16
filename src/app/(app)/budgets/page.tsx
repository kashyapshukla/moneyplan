import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listBudgetsWithSpending } from "@/lib/budgets";
import { BudgetsList } from "@/components/budgets/budgets-list";
import { MonthNav } from "@/components/budgets/month-nav";
import { OnboardingBanner } from "@/components/budgets/onboarding-banner";

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

  const budgets = await listBudgetsWithSpending(session.user.id, month, year);

  const monthName = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Budgets</h1>
          <p className="text-sm text-slate-500 mt-1">Set monthly limits per category</p>
        </div>
        <MonthNav month={month} year={year} />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-600">{monthName}</span>
        {month === now.getMonth() + 1 && year === now.getFullYear() && (
          <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">
            Current Month
          </span>
        )}
      </div>

      {budgets.length === 0 && (
        <OnboardingBanner month={month} year={year} />
      )}

      <BudgetsList initialBudgets={budgets} month={month} year={year} />
    </div>
  );
}
