import { db } from "./db";
import { transactions, netWorthSnapshots, accounts } from "./schema";
import { eq, and, gte, lte, sql, desc, ne } from "drizzle-orm";
import { getSpendingByCategory } from "./budgets";
import { listBudgetsWithSpending } from "./budgets";

export async function getDashboardData(userId: string) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  // Total income and expenses this month
  const [monthlyAggs] = await db
    .select({
      totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.amount} > 0 AND ${transactions.category}::text != 'Transfer' THEN ${transactions.amount} ELSE 0 END), 0)`,
      totalExpenses: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.amount} < 0 AND ${transactions.category}::text != 'Transfer' THEN ABS(${transactions.amount}) ELSE 0 END), 0)`,
      txCount: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, firstDay),
        lte(transactions.date, lastDay)
      )
    );

  // Recent transactions (last 5)
  const recentTxs = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(5);

  // Latest net worth snapshot
  const [latestSnapshot] = await db
    .select()
    .from(netWorthSnapshots)
    .where(eq(netWorthSnapshots.userId, userId))
    .orderBy(desc(netWorthSnapshots.snapshotDate))
    .limit(1);

  // Budgets with spending for health score
  const budgetsWithSpending = await listBudgetsWithSpending(userId, month, year);

  // Calculate budget health score (0-100)
  let healthScore = 100;
  if (budgetsWithSpending.length > 0) {
    const avgPercent =
      budgetsWithSpending.reduce((sum, b) => sum + b.percentUsed, 0) /
      budgetsWithSpending.length;
    healthScore = Math.max(0, Math.round(100 - avgPercent));
  }

  // Spending by category this month
  const spendingByCategory = await getSpendingByCategory(userId, month, year);

  return {
    month,
    year,
    totalIncome: parseFloat(monthlyAggs?.totalIncome ?? "0"),
    totalExpenses: parseFloat(monthlyAggs?.totalExpenses ?? "0"),
    txCount: Number(monthlyAggs?.txCount ?? 0),
    recentTxs,
    latestSnapshot: latestSnapshot ?? null,
    budgetsWithSpending,
    healthScore,
    spendingByCategory,
  };
}

export type AccountBreakdown = {
  accountId: string;
  accountName: string;
  accountType: string;
  income: number;
  expenses: number;
  net: number;
};

export async function getAccountBreakdown(
  userId: string,
  month: number,
  year: number
): Promise<AccountBreakdown[]> {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const rows = await db
    .select({
      accountId: accounts.id,
      accountName: accounts.name,
      accountType: accounts.type,
      income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.amount}::numeric > 0 AND ${transactions.category}::text != 'Transfer' THEN ${transactions.amount}::numeric ELSE 0 END), 0)`,
      expenses: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.amount}::numeric < 0 AND ${transactions.category}::text != 'Transfer' THEN ABS(${transactions.amount}::numeric) ELSE 0 END), 0)`,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, firstDay),
        lte(transactions.date, lastDay)
      )
    )
    .groupBy(accounts.id, accounts.name, accounts.type)
    .orderBy(desc(sql`SUM(ABS(${transactions.amount}::numeric))`));

  return rows.map((r) => ({
    accountId: r.accountId,
    accountName: r.accountName,
    accountType: r.accountType,
    income: parseFloat(r.income),
    expenses: parseFloat(r.expenses),
    net: parseFloat(r.income) - parseFloat(r.expenses),
  }));
}
