import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { incomeSources } from "@/lib/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db
    .select({ description: incomeSources.description })
    .from(incomeSources)
    .where(eq(incomeSources.userId, session.user.id));
  return NextResponse.json(rows.map((r) => r.description));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { descriptions } = await req.json() as { descriptions: string[] };
  // Replace all
  await db.delete(incomeSources).where(eq(incomeSources.userId, userId));
  if (descriptions.length > 0) {
    await db.insert(incomeSources).values(
      descriptions.map((d) => ({ id: crypto.randomUUID(), userId, description: d }))
    );
  }
  return NextResponse.json({ ok: true });
}
