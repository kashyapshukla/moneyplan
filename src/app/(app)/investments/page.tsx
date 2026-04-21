import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listHoldings, getPortfolioSummary } from "@/lib/investments";
import { AllocationChart } from "@/components/investments/allocation-chart";
import { HoldingsTable } from "@/components/investments/holdings-table";
import { db } from "@/lib/db";
import { accounts } from "@/lib/schema";
import { and, eq, isNotNull } from "drizzle-orm";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default async function InvestmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const [allHoldings, summary] = await Promise.all([
    listHoldings(session.user.id),
    getPortfolioSummary(session.user.id),
  ]);

  const [investAcct] = await db
    .select({ plaidItemId: accounts.plaidItemId })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, session.user.id),
        eq(accounts.type, "investment"),
        isNotNull(accounts.plaidItemId)
      )
    )
    .limit(1);

  const hasGainLoss = summary.totalGainLoss !== 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Investments</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {allHoldings.length} positions · {fmt(summary.totalValue)} total value
          {hasGainLoss && (
            <span
              className={`ml-2 font-semibold ${
                summary.totalGainLoss >= 0 ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {summary.totalGainLoss >= 0 ? "+" : ""}
              {fmt(summary.totalGainLoss)} (
              {summary.totalGainLossPct >= 0 ? "+" : ""}
              {summary.totalGainLossPct.toFixed(2)}%)
            </span>
          )}
        </p>
      </div>

      {allHoldings.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center">
          <p className="text-slate-400 text-sm">No holdings found.</p>
          <p className="text-slate-400 text-xs mt-1">
            Connect an investment account (Robinhood, Fidelity, etc.) via Plaid on the Net Worth page.
          </p>
        </div>
      ) : (
        <>
          <AllocationChart byType={summary.byType} totalValue={summary.totalValue} />
          <HoldingsTable
            holdings={allHoldings}
            plaidItemId={investAcct?.plaidItemId ?? null}
          />
        </>
      )}
    </div>
  );
}
