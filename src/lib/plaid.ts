import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from "plaid";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { accounts, transactions } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import type { AccountType } from "@/lib/account-types";
import type { TransactionCategory } from "@/lib/categories";

// ── Plaid SDK client ─────────────────────────────────────────────────────────

const config = new Configuration({
  basePath:
    PlaidEnvironments[
      (process.env.PLAID_ENV ?? "sandbox") as keyof typeof PlaidEnvironments
    ],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(config);

// ── Token encryption (AES-256-CBC) ───────────────────────────────────────────

const ALGORITHM = "aes-256-cbc";

function getKey(): Buffer {
  const hex = process.env.PLAID_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("PLAID_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptToken(token: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptToken(encrypted: string): string {
  const [ivHex, dataHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// ── Category + account type mapping ─────────────────────────────────────────

export function mapPlaidCategory(plaidCategory: string[] | null): TransactionCategory {
  const primary = (plaidCategory?.[0] ?? "").toLowerCase();
  if (primary.includes("food") || primary.includes("restaurant") || primary.includes("dining")) return "Food";
  if (primary.includes("travel") || primary.includes("transport") || primary.includes("taxi") || primary.includes("airline")) return "Transport";
  if (primary.includes("health") || primary.includes("medical") || primary.includes("pharma")) return "Health";
  if (primary.includes("recreation") || primary.includes("entertainment") || primary.includes("gym")) return "Entertainment";
  if (primary.includes("shop")) return "Shopping";
  if (primary.includes("transfer") || primary.includes("deposit") || primary.includes("payroll") || primary.includes("income")) return "Income";
  return "Other";
}

export function mapPlaidAccountType(type: string, subtype: string | null): AccountType {
  if (type === "depository") return subtype === "savings" ? "savings" : "checking";
  if (type === "credit") return "credit";
  if (type === "investment") return "investment";
  if (type === "loan") return "loan";
  return "checking";
}

// ── syncPlaidItem ─────────────────────────────────────────────────────────────

export async function syncPlaidItem(userId: string, accessToken: string): Promise<void> {
  // 1. Sync account balances
  const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
  for (const pa of accountsResponse.data.accounts) {
    const balance = (pa.balances.current ?? 0).toFixed(2);
    await db
      .update(accounts)
      .set({ balance, lastUpdated: new Date() })
      .where(
        and(eq(accounts.plaidAccountId, pa.account_id), eq(accounts.userId, userId))
      );
  }

  // 2. Sync transactions (last 90 days, paginated)
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const allTxs: Awaited<ReturnType<typeof plaidClient.transactionsGet>>["data"]["transactions"] = [];
  let offset = 0;
  let totalTransactions = Infinity;

  while (allTxs.length < totalTransactions) {
    const res = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { offset, count: 500 },
    });
    allTxs.push(...res.data.transactions);
    totalTransactions = res.data.total_transactions;
    offset += res.data.transactions.length;
    if (res.data.transactions.length === 0) break;
  }

  // 3. Upsert each transaction
  for (const tx of allTxs) {
    const [acct] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(eq(accounts.plaidAccountId, tx.account_id), eq(accounts.userId, userId))
      )
      .limit(1);

    if (!acct) continue;

    // Plaid: positive = debit (expense), negative = credit (income)
    // Our system: negative = expense, positive = income → negate
    const amount = (-tx.amount).toFixed(2);
    const category = mapPlaidCategory(tx.category ?? null);

    await db
      .insert(transactions)
      .values({
        userId,
        accountId: acct.id,
        amount,
        date: new Date(tx.date),
        description: tx.name,
        category,
        source: "plaid",
        plaidTransactionId: tx.transaction_id,
      })
      .onConflictDoNothing({ target: transactions.plaidTransactionId });
  }
}
