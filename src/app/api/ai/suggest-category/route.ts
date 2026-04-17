import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { categorizeTransactions } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { description, amount } = await req.json();
  if (!description || typeof description !== "string") {
    return NextResponse.json({ error: "description required" }, { status: 400 });
  }

  const [category] = await categorizeTransactions([
    { description, amount: Number(amount) || 0 },
  ]);

  return NextResponse.json({ category });
}
