import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { categorizeTransactions } from "@/lib/gemini";
import type { TransactionCategory } from "@/lib/categories";

const BATCH = 50;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  // Fetch all transactions for this user
  const allTxs = await db
    .select({ id: transactions.id, description: transactions.description, amount: transactions.amount })
    .from(transactions)
    .where(eq(transactions.userId, userId));

  if (allTxs.length === 0) {
    return NextResponse.json({ updated: 0, total: 0 });
  }

  let updated = 0;

  // Process in batches of 50
  for (let i = 0; i < allTxs.length; i += BATCH) {
    const batch = allTxs.slice(i, i + BATCH);

    const categories: TransactionCategory[] = await categorizeTransactions(
      batch.map((tx) => ({
        description: tx.description,
        amount: Number(tx.amount),
      }))
    );

    // Update each transaction in parallel
    await Promise.all(
      batch.map((tx, idx) =>
        db
          .update(transactions)
          .set({ category: categories[idx] })
          .where(eq(transactions.id, tx.id))
      )
    );

    updated += batch.length;
  }

  return NextResponse.json({ updated, total: allTxs.length });
}
