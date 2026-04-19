import { db } from "./db";
import { transactions, recurringTransactions } from "./schema";
import { eq, and, gte, ne, sql } from "drizzle-orm";
import type { TransactionCategory } from "./categories";

export type RecurringItem = {
  id: string;
  description: string;
  displayName: string;
  amount: number;
  category: string;
  frequency: "weekly" | "monthly" | "annual";
  dayOfMonth: number | null;
  lastSeen: Date;
  nextExpected: Date | null;
  isSubscription: boolean;
  isActive: boolean;
};

// Normalize description for grouping: lowercase, strip non-alphanumeric except spaces
function normalizeDesc(desc: string): string {
  return desc.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

// Compute median of a number array
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Classify interval in days → frequency label
function classifyInterval(medianDays: number): "weekly" | "monthly" | "annual" | null {
  if (medianDays >= 6 && medianDays <= 9) return "weekly";
  if (medianDays >= 25 && medianDays <= 35) return "monthly";
  if (medianDays >= 340 && medianDays <= 390) return "annual";
  return null;
}

// Project next expected date from lastSeen + frequency
function nextExpectedDate(lastSeen: Date, frequency: "weekly" | "monthly" | "annual"): Date {
  const d = new Date(lastSeen);
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

export async function detectRecurring(userId: string): Promise<number> {
  const since = new Date();
  since.setMonth(since.getMonth() - 13);

  const rows = await db
    .select({
      description: transactions.description,
      amount: transactions.amount,
      date: transactions.date,
      category: transactions.category,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, since),
        sql`${transactions.amount}::numeric < 0`,
        ne(transactions.category, "Transfer")
      )
    );

  // Group by normalized description
  const groups = new Map<string, { desc: string; amounts: number[]; dates: Date[]; category: string }>();
  for (const row of rows) {
    const key = normalizeDesc(row.description);
    if (!groups.has(key)) {
      groups.set(key, { desc: row.description, amounts: [], dates: [], category: row.category });
    }
    const g = groups.get(key)!;
    g.amounts.push(Math.abs(parseFloat(row.amount)));
    g.dates.push(new Date(row.date));
  }

  let detected = 0;

  for (const [key, g] of Array.from(groups.entries())) {
    if (g.dates.length < 2) continue;

    g.dates.sort((a, b) => a.getTime() - b.getTime());
    const intervals: number[] = [];
    for (let i = 1; i < g.dates.length; i++) {
      const diffMs = g.dates[i].getTime() - g.dates[i - 1].getTime();
      intervals.push(diffMs / (1000 * 60 * 60 * 24));
    }

    const medianInterval = median(intervals);
    const frequency = classifyInterval(medianInterval);
    if (!frequency) continue;

    // Amount consistency: coefficient of variation < 20%
    const avgAmt = g.amounts.reduce((s, v) => s + v, 0) / g.amounts.length;
    const stddev = Math.sqrt(g.amounts.reduce((s, v) => s + (v - avgAmt) ** 2, 0) / g.amounts.length);
    if (avgAmt > 0 && stddev / avgAmt > 0.2) continue;

    const lastSeen = g.dates[g.dates.length - 1];
    const dayOfMonth = frequency === "monthly" ? lastSeen.getDate() : null;
    const nextExpected = nextExpectedDate(lastSeen, frequency);

    await db
      .insert(recurringTransactions)
      .values({
        id: crypto.randomUUID(),
        userId,
        description: key,
        displayName: g.desc,
        amount: String(avgAmt.toFixed(2)),
        category: g.category as TransactionCategory,
        frequency,
        dayOfMonth,
        lastSeen,
        nextExpected,
        isSubscription: "false",
        isActive: "true",
      })
      .onConflictDoUpdate({
        target: [recurringTransactions.userId, recurringTransactions.description],
        set: {
          amount: String(avgAmt.toFixed(2)),
          lastSeen,
          nextExpected,
          dayOfMonth,
          frequency,
        },
      });

    detected++;
  }

  return detected;
}

export async function listRecurring(userId: string): Promise<RecurringItem[]> {
  const rows = await db
    .select()
    .from(recurringTransactions)
    .where(and(eq(recurringTransactions.userId, userId), eq(recurringTransactions.isActive, "true")))
    .orderBy(recurringTransactions.amount);

  return rows.map((r) => ({
    id: r.id,
    description: r.description,
    displayName: r.displayName,
    amount: parseFloat(r.amount),
    category: r.category,
    frequency: r.frequency as "weekly" | "monthly" | "annual",
    dayOfMonth: r.dayOfMonth,
    lastSeen: new Date(r.lastSeen),
    nextExpected: r.nextExpected ? new Date(r.nextExpected) : null,
    isSubscription: r.isSubscription === "true",
    isActive: r.isActive === "true",
  }));
}

export async function updateRecurring(
  id: string,
  userId: string,
  data: Partial<{ isSubscription: boolean; isActive: boolean; displayName: string }>
) {
  await db
    .update(recurringTransactions)
    .set({
      ...(data.isSubscription !== undefined && { isSubscription: data.isSubscription ? "true" : "false" }),
      ...(data.isActive !== undefined && { isActive: data.isActive ? "true" : "false" }),
      ...(data.displayName !== undefined && { displayName: data.displayName }),
    })
    .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId)));
}
