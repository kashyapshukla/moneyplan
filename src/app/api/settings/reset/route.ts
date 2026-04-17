import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { transactions, accounts, budgets, netWorthSnapshots } from "@/lib/schema";
import { eq } from "drizzle-orm";

export type ResetScope = "transactions" | "budgets" | "accounts" | "all";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scope } = (await req.json()) as { scope: ResetScope };
  const userId = session.user.id;

  if (!["transactions", "budgets", "accounts", "all"].includes(scope)) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  if (scope === "transactions" || scope === "all") {
    await db.delete(transactions).where(eq(transactions.userId, userId));
  }

  if (scope === "budgets" || scope === "all") {
    await db.delete(budgets).where(eq(budgets.userId, userId));
  }

  if (scope === "accounts" || scope === "all") {
    // Deleting accounts cascades to transactions linked to that account
    // but we keep transactions from other sources — only wipe account rows +  snapshots
    await db.delete(netWorthSnapshots).where(eq(netWorthSnapshots.userId, userId));
    await db.delete(accounts).where(eq(accounts.userId, userId));
  }

  return NextResponse.json({ ok: true, scope });
}
