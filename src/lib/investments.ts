import { db } from "./db";
import { holdings, accounts } from "./schema";
import { eq, desc } from "drizzle-orm";

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

export async function getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
  const all = await listHoldings(userId);

  const totalValue = all.reduce((s, h) => s + h.marketValue, 0);
  const totalCostBasis = all.reduce((s, h) => s + (h.costBasis ?? h.marketValue), 0);
  const totalGainLoss = totalValue - totalCostBasis;
  const totalGainLossPct = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;

  const typeMap = new Map<string, number>();
  for (const h of all) {
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
