import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { eq, and, ne, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      amount: transactions.amount,
      date: transactions.date,
      category: transactions.category,
      source: transactions.source,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, session.user.id),
        ne(transactions.verified, "true")
      )
    )
    .orderBy(desc(transactions.date))
    .limit(50);

  return NextResponse.json(rows);
}
