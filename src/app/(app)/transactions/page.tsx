import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listTransactions, TransactionCategory } from "@/lib/transactions";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { TransactionsActions } from "@/components/transactions/transactions-actions";
import { VerificationPanel } from "@/components/transactions/verification-panel";
import { Suspense } from "react";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { category?: string; search?: string; dateFrom?: string; dateTo?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const transactions = await listTransactions({
    userId: session.user.id,
    category: searchParams.category as TransactionCategory | undefined,
    search: searchParams.search,
    dateFrom: searchParams.dateFrom ? new Date(searchParams.dateFrom) : undefined,
    dateTo: searchParams.dateTo ? new Date(searchParams.dateTo) : undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500 mt-1">{transactions.length} transactions</p>
        </div>
        <TransactionsActions />
      </div>

      <VerificationPanel />

      <Suspense>
        <TransactionFilters />
      </Suspense>

      <TransactionsTable transactions={transactions} />
    </div>
  );
}
