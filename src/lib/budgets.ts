import { db } from "./db";
import { budgets, transactions } from "./schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { TransactionCategory } from "./transactions";

export type Budget = {
  id: string;
  category: TransactionCategory;
  monthlyLimit: string;
  month: number;
  year: number;
};

export type BudgetWithSpending = Budget & {
  spent: number;
  remaining: number;
  percentUsed: number;
};

export async function listBudgets(
  userId: string,
  month: number,
  year: number
): Promise<Budget[]> {
  const rows = await db
    .select()
    .from(budgets)
    .where(
      and(
        eq(budgets.userId, userId),
        eq(budgets.month, month),
        eq(budgets.year, year)
      )
    )
    .orderBy(budgets.category);

  return rows.map((r) => ({
    id: r.id,
    category: r.category as TransactionCategory,
    monthlyLimit: r.monthlyLimit,
    month: r.month,
    year: r.year,
  }));
}

export async function getSpendingByCategory(
  userId: string,
  month: number,
  year: number
): Promise<Record<string, number>> {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const rows = await db
    .select({
      category: transactions.category,
      total: sql<string>`SUM(ABS(${transactions.amount}))`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, firstDay),
        lte(transactions.date, lastDay),
        sql`${transactions.amount} < 0`
      )
    )
    .groupBy(transactions.category);

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.category] = parseFloat(row.total ?? "0");
  }
  return result;
}

export async function listBudgetsWithSpending(
  userId: string,
  month: number,
  year: number
): Promise<BudgetWithSpending[]> {
  const [budgetList, spending] = await Promise.all([
    listBudgets(userId, month, year),
    getSpendingByCategory(userId, month, year),
  ]);

  return budgetList.map((b) => {
    const limit = parseFloat(b.monthlyLimit);
    const spent = spending[b.category] ?? 0;
    const remaining = Math.max(0, limit - spent);
    const percentUsed = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
    return { ...b, spent, remaining, percentUsed };
  });
}

export async function upsertBudget(
  userId: string,
  data: { category: TransactionCategory; monthlyLimit: number; month: number; year: number }
): Promise<Budget> {
  const existing = await db
    .select()
    .from(budgets)
    .where(
      and(
        eq(budgets.userId, userId),
        eq(budgets.category, data.category),
        eq(budgets.month, data.month),
        eq(budgets.year, data.year)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(budgets)
      .set({ monthlyLimit: data.monthlyLimit.toString() })
      .where(eq(budgets.id, existing[0].id))
      .returning();
    return {
      id: updated.id,
      category: updated.category as TransactionCategory,
      monthlyLimit: updated.monthlyLimit,
      month: updated.month,
      year: updated.year,
    };
  }

  const [created] = await db
    .insert(budgets)
    .values({
      userId,
      category: data.category,
      monthlyLimit: data.monthlyLimit.toString(),
      month: data.month,
      year: data.year,
    })
    .returning();

  return {
    id: created.id,
    category: created.category as TransactionCategory,
    monthlyLimit: created.monthlyLimit,
    month: created.month,
    year: created.year,
  };
}

export async function deleteBudget(userId: string, id: string): Promise<void> {
  await db
    .delete(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
}

export type SpendingAverages = {
  byCategory: Record<string, number>;   // avg monthly spend per expense category
  totalTransactions: number;            // total tx count across 3 months
  confidence: "high" | "low";          // high = >=10 tx, low = <10
};

export async function getSpendingAverages(
  userId: string
): Promise<SpendingAverages> {
  const now = new Date();
  const byCategory: Record<string, number> = {};
  let totalTransactions = 0;

  // Collect spending for each of the last 3 months
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const spending = await getSpendingByCategory(userId, month, year);
    for (const [cat, amt] of Object.entries(spending)) {
      byCategory[cat] = (byCategory[cat] ?? 0) + amt;
    }
  }

  // Count total transactions across 3 months
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, threeMonthsAgo),
        lte(transactions.date, currentMonthStart),
        sql`${transactions.amount} < 0`
      )
    );
  totalTransactions = Number(countRow?.count ?? 0);

  // Average over 3 months
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat] = Math.round(byCategory[cat] / 3);
  }

  return {
    byCategory,
    totalTransactions,
    confidence: totalTransactions >= 10 ? "high" : "low",
  };
}
