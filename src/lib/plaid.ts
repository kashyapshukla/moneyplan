import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { accounts, transactions, holdings } from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";
import type { AccountType } from "@/lib/account-types";
import type { TransactionCategory } from "@/lib/categories";
import { categorizeTransactions } from "@/lib/gemini";
import { detectAndMarkTransfers } from "@/lib/transfer-detection";

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

export function mapPlaidCategory(plaidCategory: string[] | null): TransactionCategory | null {
  // Check both primary (index 0) and detailed (index 1) Plaid categories
  const primary = (plaidCategory?.[0] ?? "").toLowerCase();
  const detailed = (plaidCategory?.[1] ?? "").toLowerCase();
  const combined = `${primary} ${detailed}`;

  // Food & Drink — Plaid: "Food and Drink", detailed: "Restaurants", "Coffee Shop", "Groceries", "Fast Food"
  if (combined.includes("food") || combined.includes("restaurant") || combined.includes("coffee") ||
      combined.includes("groceries") || combined.includes("dining") || combined.includes("bar") ||
      combined.includes("bakeries") || combined.includes("beer") || combined.includes("winery")) return "Food";

  // Transport — Plaid: "Travel", detailed: "Ride Share", "Airlines", "Taxi", "Car Rental", "Gas Stations"
  if (primary.includes("travel") || combined.includes("ride share") || combined.includes("taxi") ||
      combined.includes("airline") || combined.includes("car rental") || combined.includes("parking") ||
      combined.includes("gas station") || combined.includes("fuel") || combined.includes("public transportation")) return "Transport";

  // Health — Plaid: "Healthcare", detailed: "Pharmacies", "Hospitals", "Dentists", "Gyms"
  if (primary.includes("health") || combined.includes("pharma") || combined.includes("hospital") ||
      combined.includes("medical") || combined.includes("doctor") || combined.includes("dentist") ||
      combined.includes("optician")) return "Health";

  // Entertainment — Plaid: "Recreation", detailed: "Gyms", "Entertainment", "Arts", "Sports"
  if (primary.includes("recreation") || combined.includes("entertainment") || combined.includes("gym") ||
      combined.includes("fitness") || combined.includes("sport") || combined.includes("music") ||
      combined.includes("streaming") || combined.includes("movie") || combined.includes("book")) return "Entertainment";

  // Shopping — Plaid: "Shops", "Service"
  if (primary.includes("shop") || combined.includes("department store") || combined.includes("clothing") ||
      combined.includes("electronics") || combined.includes("amazon") || combined.includes("retail")) return "Shopping";

  // Housing — Plaid: "Service" detailed: "Utilities", "Rent", "Home Improvement"
  if (combined.includes("utilit") || combined.includes("rent") || combined.includes("mortgage") ||
      combined.includes("home improvement") || combined.includes("internet") || combined.includes("electric")) return "Housing";

  // Income — Plaid: "Deposit", "Payroll"
  if (combined.includes("payroll") || combined.includes("income") || combined.includes("salary") ||
      combined.includes("deposit") || combined.includes("interest earned") || combined.includes("dividend")) return "Income";

  // Transfers — credit card payments and internal account moves.
  // Checked before falling through to Gemini so these are never mis-categorized.
  // (Amount-pairing in detectAndMarkTransfers catches the rest after sync.)
  if (primary === "transfer" || combined.includes("account transfer") || combined.includes("wire transfer")) return "Transfer";
  if (primary === "payment" && (detailed.includes("credit card") || detailed.includes("mortgage and rent"))) return "Transfer";

  // Return null to signal "needs Gemini categorization"
  return null;
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

  // 3. First pass: apply rule-based category mapping; collect unknowns for Gemini
  const BATCH = 50;
  const categoryMap = new Map<string, TransactionCategory>(); // txId → category

  // Rule-based pre-pass (free, instant)
  const needsAI: { txId: string; name: string; amount: number }[] = [];
  for (const tx of allTxs) {
    const ruled = mapPlaidCategory(tx.category ?? null);
    if (ruled !== null) {
      categoryMap.set(tx.transaction_id, ruled);
    } else {
      needsAI.push({
        txId: tx.transaction_id,
        name: tx.merchant_name ?? tx.name,
        amount: tx.amount,
      });
    }
  }

  // Gemini batch-categorization for unknowns (batched 50 at a time)
  for (let i = 0; i < needsAI.length; i += BATCH) {
    const batch = needsAI.slice(i, i + BATCH);
    const cats = await categorizeTransactions(
      batch.map((t) => ({ description: t.name, amount: t.amount }))
    );
    batch.forEach((t, idx) => categoryMap.set(t.txId, cats[idx]));
  }

  // 4. Upsert each transaction with resolved category
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
    const category = categoryMap.get(tx.transaction_id) ?? "Other";

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

  // Detect transfer pairs (same amount in+out within 5 days) and mark them
  await detectAndMarkTransfers(userId);
}

export async function syncInvestmentHoldings(
  userId: string,
  accessToken: string
): Promise<number> {
  let response;
  try {
    response = await plaidClient.investmentsHoldingsGet({
      access_token: accessToken,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("PRODUCT_NOT_READY") || msg.includes("INVALID_PRODUCT") || msg.includes("PRODUCTS_NOT_SUPPORTED")) {
      return 0;
    }
    throw err;
  }

  const { holdings: plaidHoldings, securities } = response.data;

  const securityMap = new Map(
    securities.map((s) => [s.security_id, s])
  );

  // Pre-fetch all accounts in a single query to avoid N+1
  const plaidAccountIds = Array.from(new Set(plaidHoldings.map((h) => h.account_id)));

  let acctMap = new Map<string, string>(); // plaidAccountId → internal accountId
  if (plaidAccountIds.length > 0) {
    const acctRows = await db
      .select({ id: accounts.id, plaidAccountId: accounts.plaidAccountId })
      .from(accounts)
      .where(
        and(
          inArray(accounts.plaidAccountId, plaidAccountIds),
          eq(accounts.userId, userId)
        )
      );
    acctMap = new Map(acctRows.map((a) => [a.plaidAccountId!, a.id]));
  }

  let synced = 0;

  for (const h of plaidHoldings) {
    const security = securityMap.get(h.security_id);
    if (!security) {
      console.warn(`syncInvestmentHoldings: unknown security_id ${h.security_id}, skipping`);
      continue;
    }

    const accountId = acctMap.get(h.account_id) ?? null;

    const securityType = security.type?.toLowerCase() ?? "other";
    const ticker = security.ticker_symbol ?? null;
    const name = security.name ?? security.ticker_symbol ?? "Unknown";

    await db
      .insert(holdings)
      .values({
        id: crypto.randomUUID(),
        userId,
        accountId,
        plaidSecurityId: h.security_id,
        ticker,
        name,
        securityType,
        quantity: h.quantity != null ? String(h.quantity) : null,
        price: h.institution_price != null ? String(h.institution_price) : null,
        marketValue: String(h.institution_value ?? 0),
        costBasis: h.cost_basis != null ? String(h.cost_basis) : null,
        lastSynced: new Date(),
      })
      .onConflictDoUpdate({
        target: [holdings.userId, holdings.plaidSecurityId],
        set: {
          quantity: h.quantity != null ? String(h.quantity) : null,
          price: h.institution_price != null ? String(h.institution_price) : null,
          marketValue: String(h.institution_value ?? 0),
          costBasis: h.cost_basis != null ? String(h.cost_basis) : null,
          lastSynced: new Date(),
        },
      });

    synced++;
  }

  return synced;
}
