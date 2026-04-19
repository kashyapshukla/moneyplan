import { db } from "./db";
import { goals, accounts, transactions } from "./schema";
import { eq, and, sql } from "drizzle-orm";

export type Goal = {
  id: string;
  name: string;
  type: "savings" | "debt_payoff" | "emergency_fund";
  targetAmount: number | null;
  currentAmount: number;
  monthlyContribution: number | null;
  interestRate: number;
  targetDate: Date | null;
  linkedAccountId: string | null;
  linkedAccountBalance: number | null;
  linkedAccountName: string | null;
  targetMonths: number | null;
  progressPct: number;
  projectedCompletionDate: Date | null;
};

function payoffMonths(balance: number, payment: number, apr: number): number {
  if (balance <= 0) return 0;
  if (apr === 0) return Math.ceil(balance / payment);
  const r = apr / 100 / 12;
  if (payment <= balance * r) return Infinity;
  return Math.ceil(-Math.log(1 - (balance * r) / payment) / Math.log(1 + r));
}

function addMonths(n: number): Date | null {
  if (!isFinite(n)) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + Math.round(n));
  return d;
}

export async function listGoals(userId: string): Promise<Goal[]> {
  const rows = await db
    .select({
      goal: goals,
      accountBalance: accounts.balance,
      accountName: accounts.name,
    })
    .from(goals)
    .leftJoin(accounts, eq(goals.linkedAccountId, accounts.id))
    .where(eq(goals.userId, userId))
    .orderBy(goals.createdAt);

  return rows.map(({ goal: g, accountBalance, accountName }) => {
    const linkedBal = accountBalance ? parseFloat(accountBalance) : null;
    const targetAmt = g.targetAmount ? parseFloat(g.targetAmount) : null;
    const currentAmt = linkedBal !== null ? Math.abs(linkedBal) : parseFloat(g.currentAmount);
    const contribution = g.monthlyContribution ? parseFloat(g.monthlyContribution) : null;
    const rate = parseFloat(g.interestRate ?? "0");

    let progressPct = 0;
    let projectedDate: Date | null = null;

    if (g.type === "savings" && targetAmt) {
      progressPct = Math.min(100, (currentAmt / targetAmt) * 100);
      if (contribution && contribution > 0) {
        const monthsLeft = Math.ceil((targetAmt - currentAmt) / contribution);
        projectedDate = monthsLeft > 0 ? addMonths(monthsLeft) : new Date();
      }
    } else if (g.type === "debt_payoff" && targetAmt && contribution) {
      const remainingBalance = currentAmt;
      const paid = targetAmt - remainingBalance;
      progressPct = Math.min(100, Math.max(0, (paid / targetAmt) * 100));
      projectedDate = addMonths(payoffMonths(currentAmt, contribution, rate));
    } else if (g.type === "emergency_fund" && targetAmt) {
      progressPct = Math.min(100, (currentAmt / targetAmt) * 100);
    }

    return {
      id: g.id,
      name: g.name,
      type: g.type,
      targetAmount: targetAmt,
      currentAmount: currentAmt,
      monthlyContribution: contribution,
      interestRate: rate,
      targetDate: g.targetDate ? new Date(g.targetDate) : null,
      linkedAccountId: g.linkedAccountId,
      linkedAccountBalance: linkedBal,
      linkedAccountName: accountName ?? null,
      targetMonths: g.targetMonths,
      progressPct,
      projectedCompletionDate: projectedDate,
    };
  });
}

export async function createGoal(
  userId: string,
  data: {
    name: string;
    type: "savings" | "debt_payoff" | "emergency_fund";
    targetAmount?: number;
    monthlyContribution?: number;
    interestRate?: number;
    targetDate?: string;
    linkedAccountId?: string;
    targetMonths?: number;
  }
) {
  const [row] = await db
    .insert(goals)
    .values({
      id: crypto.randomUUID(),
      userId,
      name: data.name,
      type: data.type,
      targetAmount: data.targetAmount != null ? String(data.targetAmount) : null,
      currentAmount: data.type === "debt_payoff" && data.targetAmount
        ? String(data.targetAmount)
        : "0",
      monthlyContribution: data.monthlyContribution != null ? String(data.monthlyContribution) : null,
      interestRate: data.interestRate != null ? String(data.interestRate) : "0",
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
      linkedAccountId: data.linkedAccountId ?? null,
      targetMonths: data.targetMonths ?? null,
    })
    .returning();
  return row;
}

export async function deleteGoal(id: string, userId: string) {
  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
}

export async function getMonthlySpendingAvg(userId: string): Promise<number> {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const [row] = await db
    .select({
      total: sql<string>`COALESCE(SUM(ABS(${transactions.amount}::numeric)), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        sql`${transactions.amount}::numeric < 0`,
        sql`${transactions.date} >= ${threeMonthsAgo.toISOString().split("T")[0]}`
      )
    );

  return parseFloat(row?.total ?? "0") / 3;
}
