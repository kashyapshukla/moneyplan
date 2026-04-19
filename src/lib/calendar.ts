import { listRecurring } from "./recurring";
import type { RecurringItem } from "./recurring";
import { getIncomeSourceDescriptions } from "./reports";
import { db } from "./db";
import { transactions } from "./schema";
import { eq, and, gte, lte, inArray, sql } from "drizzle-orm";

export type CalendarDay = {
  date: string; // "YYYY-MM-DD"
  bills: { name: string; amount: number; category: string }[];
  income: { name: string; amount: number }[];
};

function dateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function projectOccurrences(item: RecurringItem, from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  if (!item.nextExpected) return dates;

  // Start from nextExpected; if it's before `from`, advance until we're in range
  let current = new Date(item.nextExpected);

  // If nextExpected is before the range start, fast-forward to first occurrence >= from
  while (current < from) {
    if (item.frequency === "weekly") current = addDays(current, 7);
    else if (item.frequency === "monthly") current.setMonth(current.getMonth() + 1);
    else current.setFullYear(current.getFullYear() + 1);
  }

  // Collect all occurrences within range
  while (current <= to) {
    dates.push(new Date(current));
    if (item.frequency === "weekly") current = addDays(current, 7);
    else if (item.frequency === "monthly") current.setMonth(current.getMonth() + 1);
    else current.setFullYear(current.getFullYear() + 1);
  }

  return dates;
}

export async function getCalendarData(
  userId: string,
  from: Date,
  to: Date
): Promise<CalendarDay[]> {
  const [recurring, incomeDescriptions] = await Promise.all([
    listRecurring(userId),
    getIncomeSourceDescriptions(userId),
  ]);

  // Fetch actual income transactions in range
  let incomeRows: { description: string; amount: string; date: Date }[] = [];
  if (incomeDescriptions.length > 0) {
    incomeRows = await db
      .select({
        description: transactions.description,
        amount: transactions.amount,
        date: transactions.date,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, from),
          lte(transactions.date, to),
          sql`${transactions.amount}::numeric > 0`,
          inArray(transactions.description, incomeDescriptions)
        )
      );
  }

  // Build day map
  const dayMap = new Map<string, CalendarDay>();
  let current = new Date(from);
  while (current <= to) {
    const key = dateStr(current);
    dayMap.set(key, { date: key, bills: [], income: [] });
    current = addDays(current, 1);
  }

  // Place recurring bills
  for (const item of recurring) {
    for (const occ of projectOccurrences(item, from, to)) {
      const key = dateStr(occ);
      const day = dayMap.get(key);
      if (day) {
        day.bills.push({ name: item.displayName, amount: item.amount, category: item.category });
      }
    }
  }

  // Place income transactions
  for (const row of incomeRows) {
    const key = dateStr(new Date(row.date));
    const day = dayMap.get(key);
    if (day) {
      day.income.push({ name: row.description, amount: parseFloat(row.amount) });
    }
  }

  return Array.from(dayMap.values());
}
