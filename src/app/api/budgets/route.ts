import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { upsertBudget, deleteBudget, listBudgetsWithSpending } from "@/lib/budgets";
import { TransactionCategory } from "@/lib/transactions";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1));
  const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()));

  const data = await listBudgetsWithSpending(session.user.id, month, year);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { category, monthlyLimit, month, year } = body as {
    category: TransactionCategory;
    monthlyLimit: number;
    month: number;
    year: number;
  };

  const budget = await upsertBudget(session.user.id, { category, monthlyLimit, month, year });
  return NextResponse.json(budget, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await deleteBudget(session.user.id, id);
  return NextResponse.json({ success: true });
}
