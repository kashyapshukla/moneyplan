import { db } from "./db";
import { transactions } from "./schema";
import { eq, and, gte, lte, ne, sql } from "drizzle-orm";

export type SpendingAlert = {
  category: string;
  currentAmount: number;
  avgAmount: number;
  pctOver: number; // e.g. 60 means 60% over average
  message: string;
};

const ALERT_THRESHOLD = 0.5;   // 50% over avg triggers alert
const MIN_ALERT_AMOUNT = 30;   // ignore categories with <$30 current spend

export async function getSpendingAlerts(userId: string): Promise<SpendingAlert[]> {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Current month spending by category
  const currentRows = await db
    .select({
      category: transactions.category,
      total: sql<string>`SUM(ABS(${transactions.amount}::numeric))`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, currentMonthStart),
        lte(transactions.date, currentMonthEnd),
        sql`${transactions.amount}::numeric < 0`,
        ne(transactions.category, "Transfer"),
        ne(transactions.category, "Income"),
        ne(transactions.category, "Investment"),
        ne(transactions.category, "Savings")
      )
    )
    .groupBy(transactions.category);

  // Last 3 complete months average by category
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const histRows = await db
    .select({
      category: transactions.category,
      total: sql<string>`SUM(ABS(${transactions.amount}::numeric))`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, threeMonthsAgo),
        lte(transactions.date, lastMonthEnd),
        sql`${transactions.amount}::numeric < 0`,
        ne(transactions.category, "Transfer"),
        ne(transactions.category, "Income"),
        ne(transactions.category, "Investment"),
        ne(transactions.category, "Savings")
      )
    )
    .groupBy(transactions.category);

  const historicalAvg: Record<string, number> = {};
  for (const row of histRows) {
    historicalAvg[row.category] = parseFloat(row.total ?? "0") / 3;
  }

  const alerts: SpendingAlert[] = [];

  for (const row of currentRows) {
    const current = parseFloat(row.total ?? "0");
    const avg = historicalAvg[row.category] ?? 0;
    if (avg === 0 || current < MIN_ALERT_AMOUNT) continue;

    const pctOver = (current - avg) / avg;
    if (pctOver < ALERT_THRESHOLD) continue;

    alerts.push({
      category: row.category,
      currentAmount: current,
      avgAmount: avg,
      pctOver: Math.round(pctOver * 100),
      message: `You've spent ${Math.round(pctOver * 100)}% more on ${row.category} this month vs your 3-month average`,
    });
  }

  return alerts.sort((a, b) => b.pctOver - a.pctOver);
}
