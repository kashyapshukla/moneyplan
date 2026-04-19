import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMonthlyIncomeFromTransactions } from "@/lib/budgets";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getMonthlyIncomeFromTransactions(session.user.id);
  return NextResponse.json(result ?? { monthlyIncome: null, monthsUsed: 0 });
}
