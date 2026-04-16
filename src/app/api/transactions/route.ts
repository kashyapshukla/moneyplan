import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  TransactionCategory,
} from "@/lib/transactions";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const txs = await listTransactions({
    userId: session.user.id,
    category: (searchParams.get("category") as TransactionCategory) || undefined,
    search: searchParams.get("search") || undefined,
    dateFrom: searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!) : undefined,
    dateTo: searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!) : undefined,
  });
  return NextResponse.json(txs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const tx = await createTransaction({
    userId: session.user.id,
    amount: String(body.amount),
    date: new Date(body.date),
    description: body.description,
    category: body.category ?? "Other",
    source: "manual",
  });
  return NextResponse.json(tx, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...data } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const tx = await updateTransaction(id, session.user.id, {
    ...data,
    date: data.date ? new Date(data.date) : undefined,
    amount: data.amount !== undefined ? String(data.amount) : undefined,
  });
  return NextResponse.json(tx);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await deleteTransaction(id, session.user.id);
  return NextResponse.json({ success: true });
}
