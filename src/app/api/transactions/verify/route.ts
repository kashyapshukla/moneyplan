import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, category } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const updateData: Record<string, string> = { verified: "true" };
  if (category) updateData.category = category;

  await db
    .update(transactions)
    .set(updateData)
    .where(and(eq(transactions.id, id), eq(transactions.userId, session.user.id)));

  return NextResponse.json({ success: true });
}
