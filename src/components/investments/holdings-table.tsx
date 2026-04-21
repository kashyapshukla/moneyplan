"use client";
import { useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { Holding } from "@/lib/investments";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

function fmtQty(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(n);
}

export function HoldingsTable({
  holdings,
  plaidItemId,
}: {
  holdings: Holding[];
  plaidItemId: string | null;
}) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  async function syncHoldings() {
    if (!plaidItemId) return;
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/plaid/sync-holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plaidItemId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(`✓ ${data.synced} holdings updated`);
      router.refresh();
    } catch {
      setResult("Sync failed. Try again.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Holdings</h3>
          <p className="text-xs text-slate-400 mt-0.5">{holdings.length} positions</p>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <span className={`text-xs ${result.startsWith("✓") ? "text-emerald-600" : "text-red-500"}`}>
              {result}
            </span>
          )}
          {plaidItemId && (
            <Button variant="outline" size="sm" onClick={syncHoldings} disabled={syncing} className="gap-1.5">
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {syncing ? "Syncing…" : "Sync"}
            </Button>
          )}
        </div>
      </div>

      {holdings.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-slate-400 text-sm">No holdings found.</p>
          <p className="text-slate-400 text-xs mt-1">
            Connect an investment account via Plaid or click Sync.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                {["Ticker / Name", "Qty", "Price", "Market Value", "Gain / Loss"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider last:text-right"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr
                  key={h.id}
                  className="border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {h.ticker ?? "—"}
                    </p>
                    <p className="text-xs text-slate-400 truncate max-w-[180px]">{h.name}</p>
                  </td>
                  <td className="px-5 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                    {h.quantity !== null ? fmtQty(h.quantity) : "—"}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                    {h.price !== null ? fmt(h.price) : "—"}
                  </td>
                  <td className="px-5 py-3 tabular-nums font-semibold text-slate-900 dark:text-white">
                    {fmt(h.marketValue)}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-right">
                    {h.gainLoss !== null ? (
                      <div>
                        <p className={h.gainLoss >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}>
                          {h.gainLoss >= 0 ? "+" : ""}
                          {fmt(h.gainLoss)}
                        </p>
                        <p className={`text-xs ${h.gainLoss >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                          {h.gainLossPct !== null
                            ? `${h.gainLossPct >= 0 ? "+" : ""}${h.gainLossPct.toFixed(2)}%`
                            : ""}
                        </p>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
