import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { eq, and, ne, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .selectDistinct({ description: transactions.description })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, session.user.id),
        sql`${transactions.amount}::numeric > 0`,
        ne(transactions.category, "Transfer")
      )
    )
    .orderBy(transactions.description);

  return NextResponse.json(rows.map((r) => r.description));
}
