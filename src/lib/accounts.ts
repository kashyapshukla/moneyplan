import { db } from "@/lib/db";
import { accounts, netWorthSnapshots } from "@/lib/schema";
import { and, eq, desc } from "drizzle-orm";

export type AccountType =
  | "checking" | "savings" | "credit" | "investment"
  | "crypto" | "real_estate" | "loan" | "retirement" | "vehicle";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  credit: "Credit Card",
  investment: "Investment",
  crypto: "Crypto",
  real_estate: "Real Estate",
  loan: "Loan",
  retirement: "Retirement",
  vehicle: "Vehicle",
};

export const LIABILITY_TYPES: AccountType[] = ["credit", "loan"];
export const ASSET_TYPES: AccountType[] = [
  "checking", "savings", "investment", "crypto", "real_estate", "retirement", "vehicle",
];

export interface NewAccount {
  userId: string;
  name: string;
  type: AccountType;
  balance: string;
  currency?: string;
}

// ── Accounts ────────────────────────────────────────────────────────────────

export async function listAccounts(userId: string) {
  return db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .orderBy(accounts.type, accounts.name);
}

export async function createAccount(data: NewAccount) {
  const [account] = await db
    .insert(accounts)
    .values({
      userId: data.userId,
      name: data.name,
      type: data.type,
      balance: data.balance,
      currency: data.currency ?? "USD",
    })
    .returning();
  return account;
}

export async function updateAccount(
  id: string,
  userId: string,
  data: Partial<Pick<NewAccount, "name" | "type" | "balance">>
) {
  const [account] = await db
    .update(accounts)
    .set({ ...data, lastUpdated: new Date() })
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning();
  return account;
}

export async function deleteAccount(id: string, userId: string) {
  await db
    .delete(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
}

// ── Net Worth calculation ────────────────────────────────────────────────────

export function calcNetWorth(accountList: { type: string; balance: string }[]) {
  let totalAssets = 0;
  let totalLiabilities = 0;
  for (const a of accountList) {
    const bal = parseFloat(a.balance);
    if (LIABILITY_TYPES.includes(a.type as AccountType)) {
      totalLiabilities += Math.abs(bal);
    } else {
      totalAssets += bal;
    }
  }
  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  };
}

// ── Snapshots ────────────────────────────────────────────────────────────────

export async function saveNetWorthSnapshot(
  userId: string,
  totalAssets: number,
  totalLiabilities: number
) {
  const netWorth = totalAssets - totalLiabilities;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check for existing snapshot today
  const existing = await db
    .select()
    .from(netWorthSnapshots)
    .where(and(eq(netWorthSnapshots.userId, userId), eq(netWorthSnapshots.snapshotDate, today)))
    .limit(1);

  if (existing.length > 0) {
    const [snapshot] = await db
      .update(netWorthSnapshots)
      .set({
        totalAssets: String(totalAssets),
        totalLiabilities: String(totalLiabilities),
        netWorth: String(netWorth),
      })
      .where(eq(netWorthSnapshots.id, existing[0].id))
      .returning();
    return snapshot;
  }

  const [snapshot] = await db
    .insert(netWorthSnapshots)
    .values({
      userId,
      totalAssets: String(totalAssets),
      totalLiabilities: String(totalLiabilities),
      netWorth: String(netWorth),
      snapshotDate: today,
    })
    .returning();
  return snapshot;
}

export async function listSnapshots(userId: string, limit = 12) {
  return db
    .select()
    .from(netWorthSnapshots)
    .where(eq(netWorthSnapshots.userId, userId))
    .orderBy(desc(netWorthSnapshots.snapshotDate))
    .limit(limit);
}
