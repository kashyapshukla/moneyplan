import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { decryptToken, syncInvestmentHoldings } from "@/lib/plaid";
import { db } from "@/lib/db";
import { accounts } from "@/lib/schema";
import { and, eq } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { plaidItemId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { plaidItemId } = body;
  if (typeof plaidItemId !== "string" || !plaidItemId) {
    return NextResponse.json({ error: "plaidItemId required" }, { status: 400 });
  }

  const [acct] = await db
    .select({ plaidAccessToken: accounts.plaidAccessToken })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, session.user.id),
        eq(accounts.plaidItemId, plaidItemId)
      )
    )
    .limit(1);

  if (!acct?.plaidAccessToken) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    const accessToken = decryptToken(acct.plaidAccessToken);
    const synced = await syncInvestmentHoldings(session.user.id, accessToken);
    return NextResponse.json({ synced });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const detail = err instanceof Error && "response" in err
      ? JSON.stringify((err as { response?: unknown }).response)
      : "";
    console.error("sync-holdings error:", msg, detail);
    return NextResponse.json({ error: msg || "Sync failed. Please try again." }, { status: 500 });
  }
}
