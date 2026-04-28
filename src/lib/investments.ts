import { db } from "./db";
import { holdings, accounts, transactions } from "./schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";

export type MonthlyInvestment = {
  month: string;   // "Jan 2025"
  year: number;
  monthNum: number;
  invested: number;
};

// Common investment broker keywords to match transfers from bank accounts
const BROKER_KEYWORDS = [
  "robinhood", "vanguard", "fidelity", "schwab", "etrade", "e*trade",
  "td ameritrade", "ameritrade", "merrill", "wealthfront", "betterment",
  "acorns", "stash", "m1 finance", "sofi invest", "webull", "coinbase",
  "invest", "brokerage",
];

export async function getMonthlyInvestmentActivity(
  userId: string,
  months = 12
): Promise<MonthlyInvestment[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - months + 1);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  // Strategy 1: positive transactions IN investment accounts (standard Plaid sync)
  const fromInvestmentAccounts = await db
    .select({
      year: sql<number>`EXTRACT(YEAR FROM ${transactions.date})::int`,
      month: sql<number>`EXTRACT(MONTH FROM ${transactions.date})::int`,
      invested: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.amount}::numeric > 0 THEN ${transactions.amount}::numeric ELSE 0 END), 0)`,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(accounts.type, "investment"),
        gte(transactions.date, since)
      )
    )
    .groupBy(
      sql`EXTRACT(YEAR FROM ${transactions.date})`,
      sql`EXTRACT(MONTH FROM ${transactions.date})`
    );

  // Strategy 2: transfers OUT of bank/savings accounts going to investment brokers
  // (Plaid typically does NOT return transactions for investment accounts via /transactions/get,
  //  so we detect contributions by looking at outflows from bank accounts to known brokers)
  const brokerPattern = BROKER_KEYWORDS.map((k) => `%${k}%`).join("|");
  const fromBankTransfers = await db
    .select({
      year: sql<number>`EXTRACT(YEAR FROM ${transactions.date})::int`,
      month: sql<number>`EXTRACT(MONTH FROM ${transactions.date})::int`,
      invested: sql<string>`COALESCE(SUM(ABS(${transactions.amount}::numeric)), 0)`,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(transactions.userId, userId),
        sql`${accounts.type} IN ('checking', 'savings')`,
        sql`${transactions.amount}::numeric < 0`,
        sql`LOWER(${transactions.description}) SIMILAR TO ${`%(${brokerPattern})%`}`,
        gte(transactions.date, since)
      )
    )
    .groupBy(
      sql`EXTRACT(YEAR FROM ${transactions.date})`,
      sql`EXTRACT(MONTH FROM ${transactions.date})`
    );

  // Merge both sources — sum by month (avoid double-counting by taking the larger source per month)
  const dataMap = new Map<string, number>();

  for (const r of fromInvestmentAccounts) {
    const key = `${r.year}-${r.month}`;
    dataMap.set(key, (dataMap.get(key) ?? 0) + parseFloat(r.invested));
  }
  for (const r of fromBankTransfers) {
    const key = `${r.year}-${r.month}`;
    // Only add bank transfers if investment account data is absent for this month
    // (prevents double-counting if both sources report the same cash movement)
    if (!dataMap.has(key)) {
      dataMap.set(key, parseFloat(r.invested));
    }
  }

  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const result: MonthlyInvestment[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    result.push({
      month: `${MONTH_NAMES[m - 1]} ${y}`,
      year: y,
      monthNum: m,
      invested: dataMap.get(`${y}-${m}`) ?? 0,
    });
  }

  return result;
}

export type Holding = {
  id: string;
  ticker: string | null;
  name: string;
  securityType: string;
  quantity: number | null;
  price: number | null;
  marketValue: number;
  costBasis: number | null;
  gainLoss: number | null;
  gainLossPct: number | null;
  accountName: string | null;
  lastSynced: Date;
};

export type PortfolioSummary = {
  totalValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  totalGainLossPct: number;
  byType: { type: string; value: number; pct: number }[];
};

export async function listHoldings(userId: string): Promise<Holding[]> {
  const rows = await db
    .select({
      holding: holdings,
      accountName: accounts.name,
    })
    .from(holdings)
    .leftJoin(accounts, eq(holdings.accountId, accounts.id))
    .where(eq(holdings.userId, userId))
    .orderBy(desc(holdings.marketValue));

  return rows
    .map(({ holding: h, accountName }) => {
      const mv = parseFloat(h.marketValue);
      const cb = h.costBasis ? parseFloat(h.costBasis) : null;
      const gl = cb !== null ? mv - cb : null;
      const glPct = cb !== null && cb > 0 ? (gl! / cb) * 100 : null;

      return {
        id: h.id,
        ticker: h.ticker,
        name: h.name,
        securityType: h.securityType ?? "other",
        quantity: h.quantity ? parseFloat(h.quantity) : null,
        price: h.price ? parseFloat(h.price) : null,
        marketValue: mv,
        costBasis: cb,
        gainLoss: gl,
        gainLossPct: glPct,
        accountName: accountName ?? null,
        lastSynced: h.lastSynced,
      };
    })
    .sort((a, b) => b.marketValue - a.marketValue);
}

export function computePortfolioSummary(holdings: Holding[]): PortfolioSummary {
  const totalValue = holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalCostBasis = holdings.reduce((s, h) => s + (h.costBasis ?? h.marketValue), 0);
  const totalGainLoss = totalValue - totalCostBasis;
  const totalGainLossPct = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;

  const typeMap = new Map<string, number>();
  for (const h of holdings) {
    const t = h.securityType;
    typeMap.set(t, (typeMap.get(t) ?? 0) + h.marketValue);
  }

  const byType = Array.from(typeMap.entries())
    .map(([type, value]) => ({
      type,
      value,
      pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  return { totalValue, totalCostBasis, totalGainLoss, totalGainLossPct, byType };
}

// Keep the original async version for backward compatibility
export async function getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
  const all = await listHoldings(userId);
  return computePortfolioSummary(all);
}
