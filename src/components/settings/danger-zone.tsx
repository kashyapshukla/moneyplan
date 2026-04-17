"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle } from "lucide-react";
import type { ResetScope } from "@/app/api/settings/reset/route";

type Action = {
  scope: ResetScope;
  label: string;
  description: string;
  confirmText: string;
};

const ACTIONS: Action[] = [
  {
    scope: "transactions",
    label: "Clear Transactions",
    description: "Delete all your transaction history. Budgets and accounts are kept.",
    confirmText: "delete all transactions",
  },
  {
    scope: "budgets",
    label: "Clear Budgets",
    description: "Remove all monthly budget limits. Transactions and accounts are kept.",
    confirmText: "delete all budgets",
  },
  {
    scope: "accounts",
    label: "Clear Accounts",
    description: "Delete all accounts and net worth snapshots. Transactions are kept.",
    confirmText: "delete all accounts",
  },
  {
    scope: "all",
    label: "Reset Everything",
    description: "Wipe all transactions, budgets, accounts and snapshots. Start fresh.",
    confirmText: "reset everything",
  },
];

export function DangerZone() {
  const router = useRouter();
  const [confirming, setConfirming] = useState<ResetScope | null>(null);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<ResetScope | null>(null);

  const action = ACTIONS.find((a) => a.scope === confirming);

  async function handleReset() {
    if (!confirming || typed !== action?.confirmText) return;
    setLoading(true);
    try {
      await fetch("/api/settings/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: confirming }),
      });
      setDone(confirming);
      setConfirming(null);
      setTyped("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-red-200 bg-white p-6 space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide">Danger Zone</h2>
      </div>

      <div className="divide-y divide-slate-100">
        {ACTIONS.map((a) => (
          <div key={a.scope} className="flex items-center justify-between py-4 gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">{a.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>
              {done === a.scope && (
                <p className="text-xs text-green-600 mt-1 font-medium">✓ Done</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 gap-1.5"
              onClick={() => { setConfirming(a.scope); setTyped(""); setDone(null); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {a.label}
            </Button>
          </div>
        ))}
      </div>

      {/* Inline confirmation */}
      {confirming && action && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 space-y-3">
          <p className="text-sm font-medium text-red-800">
            Are you sure? This cannot be undone.
          </p>
          <p className="text-xs text-red-600">
            Type <span className="font-mono font-semibold">{action.confirmText}</span> to confirm.
          </p>
          <input
            autoFocus
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleReset()}
            placeholder={action.confirmText}
            className="w-full rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-red-500 font-mono"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={typed !== action.confirmText || loading}
              onClick={handleReset}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? "Deleting…" : "Confirm"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setConfirming(null); setTyped(""); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
