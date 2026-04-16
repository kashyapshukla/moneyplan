import { db } from "./db";
import { transactions } from "./schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export type MonthlyReport = {
  month: number;
  year: number;
  label: string; // e.g. "Jan 2025"
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
  byCategory: Record<string, number>;
};

const MONTH_ABBRS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export async function getMonthlyReports(
  userId: string,
  numMonths = 6
): Promise<MonthlyReport[]> {
  const now = new Date();
  const reports: MonthlyReport[] = [];

  for (let i = numMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    // Totals
    const [agg] = await db
      .select({
        income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END), 0)`,
        expenses: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.amount} < 0 THEN ABS(${transactions.amount}) ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, firstDay),
          lte(transactions.date, lastDay)
        )
      );

    // By category (expenses only)
    const catRows = await db
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

    const byCategory: Record<string, number> = {};
    for (const row of catRows) {
      byCategory[row.category] = parseFloat(row.total ?? "0");
    }

    const income = parseFloat(agg?.income ?? "0");
    const expenses = parseFloat(agg?.expenses ?? "0");
    const savings = income - expenses;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;

    reports.push({
      month,
      year,
      label: `${MONTH_ABBRS[month - 1]} ${year}`,
      income,
      expenses,
      savings,
      savingsRate,
      byCategory,
    });
  }

  return reports;
}

export async function getForecast(reports: MonthlyReport[], numMonths = 3) {
  if (reports.length < 2) return [];

  // Average income, expenses from last N months
  const avgIncome = reports.reduce((s, r) => s + r.income, 0) / reports.length;
  const avgExpenses = reports.reduce((s, r) => s + r.expenses, 0) / reports.length;

  // Linear trend for expenses: slope via least squares
  const n = reports.length;
  const xMean = (n - 1) / 2;
  const yMean = reports.reduce((s, r) => s + r.expenses, 0) / n;
  let numerator = 0;
  let denominator = 0;
  reports.forEach((r, i) => {
    numerator += (i - xMean) * (r.expenses - yMean);
    denominator += (i - xMean) ** 2;
  });
  const slope = denominator !== 0 ? numerator / denominator : 0;

  const now = new Date();
  const MONTH_ABBRS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return Array.from({ length: numMonths }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    const projectedExpenses = Math.max(0, avgExpenses + slope * (n + i));
    const projectedIncome = avgIncome;
    return {
      label: `${MONTH_ABBRS[d.getMonth()]} ${d.getFullYear()}`,
      income: Math.round(projectedIncome),
      expenses: Math.round(projectedExpenses),
      savings: Math.round(projectedIncome - projectedExpenses),
      forecast: true,
    };
  });
}
