import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { decryptToken, syncPlaidItem } from "@/lib/plaid";
import { db } from "@/lib/db";
import { accounts } from "@/lib/schema";
import { and, eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let body: { plaidItemId?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const plaidItemId = body.plaidItemId;
  if (typeof plaidItemId !== "string" || !plaidItemId) {
    return new Response(JSON.stringify({ error: "plaidItemId is required" }), { status: 400 });
  }

  // Find any account with this itemId belonging to the current user
  const [account] = await db
    .select({ plaidAccessToken: accounts.plaidAccessToken })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, session.user.id),
        eq(accounts.plaidItemId, plaidItemId)
      )
    )
    .limit(1);

  if (!account?.plaidAccessToken) {
    return new Response(JSON.stringify({ error: "Plaid account not found" }), { status: 404 });
  }

  try {
    const accessToken = decryptToken(account.plaidAccessToken);
    await syncPlaidItem(session.user.id, accessToken);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Plaid sync error:", err);
    return new Response(JSON.stringify({ error: "Sync failed. Please try again." }), { status: 500 });
  }
}
