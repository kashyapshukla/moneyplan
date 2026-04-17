import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { plaidClient, encryptToken, mapPlaidAccountType, syncPlaidItem } from "@/lib/plaid";
import { db } from "@/lib/db";
import { accounts } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let body: { publicToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const publicToken = body.publicToken;
  if (typeof publicToken !== "string" || !publicToken) {
    return new Response(JSON.stringify({ error: "publicToken is required" }), { status: 400 });
  }

  try {
    // Exchange public token for permanent access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;
    const encryptedToken = encryptToken(accessToken);

    // Fetch accounts from Plaid
    const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });

    for (const pa of accountsResponse.data.accounts) {
      const type = mapPlaidAccountType(pa.type, pa.subtype ?? null);
      const balance = (pa.balances.current ?? 0).toFixed(2);

      // Upsert: update if already connected, insert if new
      const existing = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.plaidAccountId, pa.account_id))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(accounts)
          .set({ balance, lastUpdated: new Date() })
          .where(eq(accounts.plaidAccountId, pa.account_id));
      } else {
        await db.insert(accounts).values({
          userId: session.user.id,
          name: pa.name,
          type,
          balance,
          currency: "USD",
          plaidAccountId: pa.account_id,
          plaidAccessToken: encryptedToken,
          plaidItemId: itemId,
        });
      }
    }

    // Run initial transaction sync (last 90 days)
    await syncPlaidItem(session.user.id, accessToken);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Plaid exchange-token error:", err);
    return new Response(JSON.stringify({ error: "Could not connect bank account" }), { status: 500 });
  }
}
