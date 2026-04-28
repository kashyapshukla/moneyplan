import { db } from "./db";
import { transactions, incomeSources } from "./schema";
import { eq, and, gte, lte, sql, ne, inArray } from "drizzle-orm";

export type MonthlyReport = {
  month: number;
  year: number;
  label: string; // e.g. "Jan 2025"
  income: number;
  expenses: number;   // pure consumption only (excludes Investment + Savings outflows)
  saved: number;      // Savings category outflows
  invested: number;   // Investment category outflows
  savings: number;    // income - expenses (cash kept = saved + invested + leftover)
  savingsRate: number; // (saved + invested) / income
  byCategory: Record<string, number>;
};

const MONTH_ABBRS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Returns the user's chosen income source descriptions.
// Empty array = no filter configured (use all positive transactions).
export async function getIncomeSourceDescriptions(userId: string): Promise<string[]> {
  const rows = await db
    .select({ description: incomeSources.description })
    .from(incomeSources)
    .where(eq(incomeSources.userId, userId));
  return rows.map((r) => r.description);
}

export async function getMonthlyReports(
  userId: string,
  numMonths = 6
): Promise<MonthlyReport[]> {
  const now = new Date();
  const reports: MonthlyReport[] = [];
  const sourcesFilter = await getIncomeSourceDescriptions(userId);

  for (let i = numMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    // Totals — income filtered by selected sources if configured; always excludes Transfer
    const incomeConditions = and(
      eq(transactions.userId, userId),
      gte(transactions.date, firstDay),
      lte(transactions.date, lastDay),
      sql`${transactions.amount} > 0`,
      ne(transactions.category, "Transfer"),
      ...(sourcesFilter.length > 0 ? [inArray(transactions.description, sourcesFilter)] : [])
    );
    const expenseConditions = and(
      eq(transactions.userId, userId),
      gte(transactions.date, firstDay),
      lte(transactions.date, lastDay),
      sql`${transactions.amount} < 0`,
      ne(transactions.category, "Transfer")
    );

    const [incomeAgg] = await db
      .select({
        income: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(incomeConditions);

    const [expenseAgg] = await db
      .select({
        expenses: sql<string>`COALESCE(SUM(ABS(${transactions.amount})), 0)`,
      })
      .from(transactions)
      .where(expenseConditions);

    // By category (expenses only, excluding Transfer)
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
          sql`${transactions.amount} < 0`,
          ne(transactions.category, "Transfer")
        )
      )
      .groupBy(transactions.category);

    const byCategory: Record<string, number> = {};
    for (const row of catRows) {
      byCategory[row.category] = parseFloat(row.total ?? "0");
    }

    const income = parseFloat(incomeAgg?.income ?? "0");
    const totalOutflow = parseFloat(expenseAgg?.expenses ?? "0");
    // Split outflows: pure savings vs pure investment vs consumption
    const saved    = byCategory["Savings"]    ?? 0;
    const invested = byCategory["Investment"] ?? 0;
    const expenses = totalOutflow - saved - invested; // pure consumption
    const savings  = income - expenses;               // income minus consumption (includes saved+invested+leftover)
    const savingsRate = income > 0 ? ((saved + invested) / income) * 100 : 0;

    reports.push({
      month,
      year,
      label: `${MONTH_ABBRS[month - 1]} ${year}`,
      income,
      expenses,
      saved,
      invested,
      savings,
      savingsRate,
      byCategory,
    });
  }

  return reports;
}

export async function getForecast(reports: MonthlyReport[], numMonths = 3) {
  if (reports.length < 2) return [];

  const avgIncome   = reports.reduce((s, r) => s + r.income,   0) / reports.length;
  const avgExpenses = reports.reduce((s, r) => s + r.expenses, 0) / reports.length; // pure consumption
  const avgSaved    = reports.reduce((s, r) => s + r.saved,    0) / reports.length;
  const avgInvested = reports.reduce((s, r) => s + r.invested, 0) / reports.length;

  // Linear trend on pure consumption only (investment habit shouldn't skew forecast)
  const n = reports.length;
  const xMean = (n - 1) / 2;
  const yMean = avgExpenses;
  let numerator = 0;
  let denominator = 0;
  reports.forEach((r, i) => {
    numerator   += (i - xMean) * (r.expenses - yMean);
    denominator += (i - xMean) ** 2;
  });
  const slope = denominator !== 0 ? numerator / denominator : 0;

  const now = new Date();
  const MONTH_ABBRS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return Array.from({ length: numMonths }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    const projectedExpenses = Math.max(0, avgExpenses + slope * (n + i));
    return {
      label:    `${MONTH_ABBRS[d.getMonth()]} ${d.getFullYear()}`,
      income:   Math.round(avgIncome),
      expenses: Math.round(projectedExpenses),
      saved:    Math.round(avgSaved),
      invested: Math.round(avgInvested),
      savings:  Math.round(avgIncome - projectedExpenses),
      forecast: true,
    };
  });
}

// ── Cash flow data for Sankey diagram ────────────────────────────────────────

export type CashFlowData = {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  byCategory: { category: string; amount: number }[]; // expense categories only, sorted desc
};

export async function getCashFlowData(
  userId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<CashFlowData> {
  const descriptions = await getIncomeSourceDescriptions(userId);

  // Total income (positive transactions, filtered by selected sources if configured)
  const [incomeRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, dateFrom),
        lte(transactions.date, dateTo),
        sql`${transactions.amount}::numeric > 0`,
        ne(transactions.category, "Transfer"),
        ...(descriptions.length > 0 ? [inArray(transactions.description, descriptions)] : [])
      )
    );

  // Expenses by category (negative, not Transfer/Income)
  const catRows = await db
    .select({
      category: transactions.category,
      total: sql<string>`SUM(ABS(${transactions.amount}::numeric))`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, dateFrom),
        lte(transactions.date, dateTo),
        sql`${transactions.amount}::numeric < 0`,
        ne(transactions.category, "Transfer"),
        ne(transactions.category, "Income")
      )
    )
    .groupBy(transactions.category);

  const totalIncome = parseFloat(incomeRow?.total ?? "0");
  const byCategory = catRows
    .map((r) => ({ category: r.category, amount: parseFloat(r.total ?? "0") }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const totalExpenses = byCategory.reduce((s, r) => s + r.amount, 0);
  const netSavings = totalIncome - totalExpenses; // allow negative to show deficit
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  return { totalIncome, totalExpenses, netSavings, savingsRate, byCategory };
}
