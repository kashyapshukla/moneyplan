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
  frequency: "weekly" | "biweekly" | "monthly" | "annual";
  dayOfMonth: number | null;
  lastSeen: Date;
  nextExpected: Date | null;
  isSubscription: boolean;
  isActive: boolean;
};

/**
 * Strip bank-added noise from transaction descriptions so the same merchant
 * groups together even when the bank appends different suffixes each month.
 *
 * Examples handled:
 *   "CHECKCARD 0412 NETFLIX.COM"  → "netflix"
 *   "LA FITNESS 0517 TX"          → "la fitness"
 *   "NETFLIX *STREAMING"          → "netflix"
 *   "COMCAST 800-266-2278"        → "comcast"
 *   "ACH DEBIT SPOTIFY USA"       → "spotify usa"
 */
function normalizeDesc(desc: string): string {
  let s = desc.toLowerCase().trim();

  // Strip common bank-added prefixes that appear before the merchant name
  s = s.replace(/^check\s*card\s*\d*\s+/i, "");
  s = s.replace(/^pos\s+(debit|credit|purchase)\s+/i, "");
  s = s.replace(/^ach\s+(debit|credit|payment)\s+/i, "");
  s = s.replace(/^debit\s+(card\s+)?(purchase\s+)?/i, "");
  s = s.replace(/^online\s+(banking\s+)?payment\s+/i, "");
  s = s.replace(/^(autopay|auto\s+pay)\s+/i, "");
  s = s.replace(/^recurring\s+(payment\s+|charge\s+)?/i, "");
  s = s.replace(/^direct\s+debit\s+/i, "");
  s = s.replace(/^bill\s+pay(ment)?\s+/i, "");

  // Strip domain suffixes
  s = s.replace(/\.(com|net|org|io|co)\b/g, "");

  // Strip trailing phone numbers (e.g. "COMCAST 800-266-2278")
  s = s.replace(/\s+\d{3}[-.]?\d{3}[-.]?\d{4}\s*$/, "");

  // Strip trailing bank-appended noise: date codes, state codes, reference IDs
  s = s.replace(/\s+\d{2}\/\d{2}(\/\d{2,4})?\s*$/, ""); // 01/15 or 01/15/24
  s = s.replace(/\s+\d{4}\s*$/, "");                      // 4-digit code: 0412
  s = s.replace(/\s+\*[a-z0-9]+\s*$/i, "");              // *STREAMING
  s = s.replace(/\s+#[a-z0-9]+\s*$/i, "");               // #REF123
  s = s.replace(/\s+[a-z0-9]{8,}\s*$/i, "");             // long trailing alphanumeric ref

  // Strip remaining special chars, normalize whitespace
  s = s.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  return s;
}

// Compute median of a number array
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Classify interval in days → frequency label
function classifyInterval(
  medianDays: number
): "weekly" | "biweekly" | "monthly" | "annual" | null {
  if (medianDays >= 5 && medianDays <= 10) return "weekly";
  if (medianDays >= 12 && medianDays <= 16) return "biweekly";
  if (medianDays >= 24 && medianDays <= 37) return "monthly";   // wider window for short/long months
  if (medianDays >= 340 && medianDays <= 395) return "annual";
  return null;
}

/**
 * Advance a date by exactly one calendar month, clamped to the last day of
 * the target month.  Fixes the setMonth() overflow bug where Jan 31 → Mar 2
 * instead of Feb 28/29.
 */
function addOneMonth(d: Date): Date {
  const result = new Date(d);
  const targetMonth = result.getMonth() + 1;
  result.setMonth(targetMonth);
  // If JS overflowed into the next month (e.g. Jan 31 → Mar 2), back up to
  // the last day of the intended month.
  if (result.getMonth() !== targetMonth % 12) {
    result.setDate(0); // setDate(0) = last day of previous month
  }
  return result;
}

// Project next expected date from lastSeen + frequency
function nextExpectedDate(
  lastSeen: Date,
  frequency: "weekly" | "biweekly" | "monthly" | "annual"
): Date {
  if (frequency === "weekly") {
    const d = new Date(lastSeen);
    d.setDate(d.getDate() + 7);
    return d;
  }
  if (frequency === "biweekly") {
    const d = new Date(lastSeen);
    d.setDate(d.getDate() + 14);
    return d;
  }
  if (frequency === "monthly") {
    return addOneMonth(lastSeen);
  }
  // annual
  const d = new Date(lastSeen);
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

export async function detectRecurring(userId: string): Promise<number> {
  // Fetch last 13 months of expense transactions (negative, non-Transfer)
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
  const groups = new Map<
    string,
    { desc: string; amounts: number[]; dates: Date[]; category: string }
  >();

  for (const row of rows) {
    const key = normalizeDesc(row.description);
    if (!key) continue; // skip if normalization produced empty string

    if (!groups.has(key)) {
      groups.set(key, {
        desc: row.description,
        amounts: [],
        dates: [],
        category: row.category,
      });
    }
    const g = groups.get(key)!;
    g.amounts.push(Math.abs(parseFloat(row.amount)));
    // Drizzle returns Date objects for mode:"date", but guard both cases
    g.dates.push(row.date instanceof Date ? row.date : new Date(row.date as string));
  }

  let detected = 0;

  for (const [key, g] of Array.from(groups.entries())) {
    if (g.dates.length < 2) continue;

    // Sort dates ascending, then deduplicate same-day entries (e.g. two charges
    // on the same day would produce a 0-day interval and confuse classification)
    g.dates.sort((a, b) => a.getTime() - b.getTime());
    const uniqueDates: Date[] = [g.dates[0]];
    for (let i = 1; i < g.dates.length; i++) {
      const dayDiff =
        (g.dates[i].getTime() - g.dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
      if (dayDiff >= 1) uniqueDates.push(g.dates[i]);
    }
    if (uniqueDates.length < 2) continue;

    // Compute day-intervals between consecutive occurrences
    const intervals: number[] = [];
    for (let i = 1; i < uniqueDates.length; i++) {
      const diffMs = uniqueDates[i].getTime() - uniqueDates[i - 1].getTime();
      intervals.push(diffMs / (1000 * 60 * 60 * 24));
    }

    const medianInterval = median(intervals);
    const frequency = classifyInterval(medianInterval);
    if (!frequency) continue;

    // Amount consistency: CV < 40%.
    // Loosened from 20% to catch variable recurring bills (utilities, phone
    // bills with usage charges, subscriptions that had a price increase).
    const avgAmt = g.amounts.reduce((s, v) => s + v, 0) / g.amounts.length;
    const stddev = Math.sqrt(
      g.amounts.reduce((s, v) => s + (v - avgAmt) ** 2, 0) / g.amounts.length
    );
    if (avgAmt > 0 && stddev / avgAmt > 0.4) continue;

    const lastSeen = uniqueDates[uniqueDates.length - 1];
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
    .where(
      and(
        eq(recurringTransactions.userId, userId),
        eq(recurringTransactions.isActive, "true")
      )
    )
    .orderBy(recurringTransactions.amount);

  return rows.map((r) => ({
    id: r.id,
    description: r.description,
    displayName: r.displayName,
    amount: parseFloat(r.amount),
    category: r.category,
    frequency: r.frequency as "weekly" | "biweekly" | "monthly" | "annual",
    dayOfMonth: r.dayOfMonth,
    lastSeen: r.lastSeen instanceof Date ? r.lastSeen : new Date(r.lastSeen as string),
    nextExpected: r.nextExpected
      ? r.nextExpected instanceof Date
        ? r.nextExpected
        : new Date(r.nextExpected as string)
      : null,
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
      ...(data.isSubscription !== undefined && {
        isSubscription: data.isSubscription ? "true" : "false",
      }),
      ...(data.isActive !== undefined && {
        isActive: data.isActive ? "true" : "false",
      }),
      ...(data.displayName !== undefined && { displayName: data.displayName }),
    })
    .where(
      and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId))
    );
}
