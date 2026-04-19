/**
 * Transfer Detection — Amount-Pairing Algorithm
 *
 * A transaction is only marked "Transfer" if we find a matching transaction for the
 * same user where:
 *   - The absolute amount matches within $0.02 (rounding tolerance)
 *   - The signs are opposite (one is a debit, the other a credit)
 *   - The dates are within WINDOW_DAYS of each other
 *
 * This avoids false positives from keyword matching (e.g. a $50 Venmo payment to
 * a friend is NOT a transfer — it's spending. A $500 outflow + $500 inflow within
 * 3 days IS a transfer between accounts).
 *
 * Called after every Plaid sync or CSV upload.
 */

import { db } from "./db";
import { transactions } from "./schema";
import { eq, and, ne } from "drizzle-orm";

const WINDOW_DAYS = 5;   // max days apart for a pair to count as a transfer
const AMT_TOLERANCE = 0.02; // dollar tolerance for rounding differences

export async function detectAndMarkTransfers(userId: string): Promise<number> {
  // Fetch all non-verified, non-already-Transfer transactions for this user
  const rows = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      date: transactions.date,
      category: transactions.category,
      verified: transactions.verified,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        ne(transactions.verified, "true"),   // skip already-verified
        ne(transactions.category, "Income")  // never pair income transactions
      )
    );

  if (rows.length < 2) return 0;

  // Convert amounts to numbers and dates to timestamps once
  const parsed = rows.map((r) => ({
    id: r.id,
    amount: parseFloat(r.amount),
    ts: new Date(r.date).getTime(),
    category: r.category,
  }));

  const transferIds = new Set<string>();

  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const a = parsed[i];
      const b = parsed[j];

      // Must be opposite signs (one in, one out)
      if (Math.sign(a.amount) === Math.sign(b.amount)) continue;

      // Amounts must match within tolerance
      if (Math.abs(Math.abs(a.amount) - Math.abs(b.amount)) > AMT_TOLERANCE) continue;

      // Dates must be within window
      const daysDiff = Math.abs(a.ts - b.ts) / (1000 * 60 * 60 * 24);
      if (daysDiff > WINDOW_DAYS) continue;

      // It's a pair — mark both as Transfer
      transferIds.add(a.id);
      transferIds.add(b.id);
    }
  }

  if (transferIds.size === 0) return 0;

  // Update in parallel batches
  await Promise.all(
    Array.from(transferIds).map((id) =>
      db
        .update(transactions)
        .set({ category: "Transfer" })
        .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    )
  );

  return transferIds.size;
}
