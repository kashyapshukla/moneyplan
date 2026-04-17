"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountFormDialog } from "./account-form-dialog";
import { ACCOUNT_TYPE_LABELS, LIABILITY_TYPES, AccountType, calcNetWorth } from "@/lib/account-types";
import { useRouter } from "next/navigation";

type Account = {
  id: string;
  name: string;
  type: AccountType;
  balance: string;
  plaidAccountId: string | null;
  plaidItemId: string | null;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function AccountsList({ initialAccounts }: { initialAccounts: Account[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string>("");
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("Delete this account?")) return;
    await fetch("/api/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    router.refresh();
  }

  function handleSaved(account: Account) {
    setAccounts((prev) =>
      editing
        ? prev.map((a) => (a.id === account.id ? account : a))
        : [...prev, account]
    );
    setEditing(null);
    router.refresh();
  }

  async function handleSync(plaidItemId: string) {
    setSyncingItemId(plaidItemId);
    setSyncError("");
    try {
      const res = await fetch("/api/plaid/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plaidItemId }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setSyncError("Sync failed. Please try again.");
    } finally {
      setSyncingItemId(null);
    }
  }

  const assets = accounts.filter((a) => !LIABILITY_TYPES.includes(a.type));
  const liabilities = accounts.filter((a) => LIABILITY_TYPES.includes(a.type));

  function AccountGroup({ title, items, color }: { title: string; items: Account[]; color: string }) {
    return (
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{title}</h3>
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-2">None added yet</p>
        ) : (
          <div className="space-y-2">
            {items.map((a) => {
              const bal = parseFloat(a.balance);
              const isPlaid = !!a.plaidAccountId;
              const isSyncing = syncingItemId === a.plaidItemId;

              return (
                <div key={a.id} className="flex items-center justify-between rounded-lg border bg-white px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{a.name}</p>
                      {isPlaid && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                          🏦 Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{ACCOUNT_TYPE_LABELS[a.type]}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold tabular-nums ${color}`}>
                      {fmt(Math.abs(bal))}
                    </span>
                    <div className="flex gap-1">
                      {isPlaid ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => a.plaidItemId && handleSync(a.plaidItemId)}
                          disabled={isSyncing}
                          className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-800 gap-1"
                        >
                          {isSyncing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          {isSyncing ? "Syncing..." : "Sync Now"}
                        </Button>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setEditing(a)} className="h-7 w-7 p-0">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-slate-50 p-5 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Accounts & Assets</h2>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" />
          Add Account
        </Button>
      </div>

      {syncError && (
        <p className="text-xs text-red-500">{syncError}</p>
      )}

      <AccountGroup title="Assets" items={assets} color="text-slate-900" />
      <AccountGroup title="Liabilities" items={liabilities} color="text-red-600" />

      <AccountFormDialog
        open={addOpen || !!editing}
        onOpenChange={(o) => { if (!o) { setAddOpen(false); setEditing(null); } }}
        onSaved={handleSaved}
        initial={editing}
      />
    </div>
  );
}
