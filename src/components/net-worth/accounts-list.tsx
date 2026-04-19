"use client";

import { useState } from "react";
import {
  Pencil,
  Trash2,
  Plus,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountFormDialog } from "./account-form-dialog";
import { ACCOUNT_TYPE_LABELS, AccountType } from "@/lib/account-types";
import { PlaidConnectButton } from "./plaid-connect-button";
import { useRouter } from "next/navigation";

type Account = {
  id: string;
  name: string;
  type: AccountType;
  balance: string;
  lastUpdated: Date;
  plaidAccountId: string | null;
  plaidItemId: string | null;
};

const ACCOUNT_GROUPS = [
  {
    key: "cash",
    label: "Cash",
    types: ["checking", "savings"] as AccountType[],
    color: "#14b8a6",
    isLiability: false,
  },
  {
    key: "investment",
    label: "Investments",
    types: ["investment", "retirement", "crypto"] as AccountType[],
    color: "#06b6d4",
    isLiability: false,
  },
  {
    key: "real_estate",
    label: "Real Estate",
    types: ["real_estate"] as AccountType[],
    color: "#8b5cf6",
    isLiability: false,
  },
  {
    key: "vehicle",
    label: "Vehicles",
    types: ["vehicle"] as AccountType[],
    color: "#f97316",
    isLiability: false,
  },
  {
    key: "credit",
    label: "Credit Cards",
    types: ["credit"] as AccountType[],
    color: "#ef4444",
    isLiability: true,
  },
  {
    key: "loan",
    label: "Loans",
    types: ["loan"] as AccountType[],
    color: "#f59e0b",
    isLiability: true,
  },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtFull(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AccountsList({ initialAccounts }: { initialAccounts: Account[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncError, setSyncError] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const router = useRouter();

  async function handleDelete(id: string, isPlaid: boolean) {
    const message = isPlaid
      ? "Disconnect this bank account?\n\nThe account and its linked data will be removed. Your existing transactions will be kept."
      : "Delete this account?";
    if (!confirm(message)) return;
    setDeletingId(id);
    try {
      await fetch("/api/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      router.refresh();
    } finally {
      setDeletingId(null);
    }
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

  async function handleSyncAll() {
    const plaidItemIds = Array.from(
      new Set(
        accounts
          .filter((a) => a.plaidItemId)
          .map((a) => a.plaidItemId as string)
      )
    );
    if (plaidItemIds.length === 0) return;
    setSyncingAll(true);
    setSyncError("");
    try {
      await Promise.all(
        plaidItemIds.map((id) =>
          fetch("/api/plaid/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plaidItemId: id }),
          })
        )
      );
      router.refresh();
    } catch {
      setSyncError("One or more accounts failed to sync. Please try again.");
    } finally {
      setSyncingAll(false);
    }
  }

  function toggleGroup(key: string) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* List header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">Accounts</h2>
        <div className="flex items-center gap-2">
          {accounts.some((a) => a.plaidItemId) && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSyncAll}
              disabled={syncingAll || !!syncingItemId}
              className="gap-1.5 h-8 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            >
              {syncingAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {syncingAll ? "Syncing..." : "Refresh All"}
            </Button>
          )}
          <PlaidConnectButton />
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="gap-1.5 h-8"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Account
          </Button>
        </div>
      </div>

      {syncError && (
        <p className="text-xs text-red-500 px-5 py-2 bg-red-50">{syncError}</p>
      )}

      {/* Groups */}
      {ACCOUNT_GROUPS.map((group) => {
        const items = accounts.filter((a) => group.types.includes(a.type));
        if (items.length === 0) return null;

        const groupTotal = items.reduce((sum, a) => {
          const bal = parseFloat(a.balance);
          return sum + (group.isLiability ? Math.abs(bal) : bal);
        }, 0);

        const isCollapsed = collapsed[group.key];

        return (
          <div key={group.key}>
            {/* Group header */}
            <button
              className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors text-left"
              onClick={() => toggleGroup(group.key)}
              type="button"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
              )}
              {/* color dot */}
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: group.color }}
              />
              <span className="text-sm font-semibold text-slate-700 flex-1">
                {group.label}
              </span>
              <span
                className={`text-sm font-bold tabular-nums ${
                  group.isLiability ? "text-red-600" : "text-slate-900"
                }`}
              >
                {fmt(groupTotal)}
              </span>
            </button>

            {/* Account rows */}
            {!isCollapsed &&
              items.map((a) => {
                const bal = parseFloat(a.balance);
                const isPlaid = !!a.plaidAccountId;
                const isSyncing = syncingItemId === a.plaidItemId;
                const initial = a.name.charAt(0).toUpperCase();

                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0 bg-white hover:bg-slate-50/60 transition-colors"
                    style={{ borderLeftWidth: "4px", borderLeftColor: group.color, borderLeftStyle: "solid" }}
                  >
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: group.color }}
                    >
                      {initial}
                    </div>

                    {/* Name + type */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{a.name}</p>
                      <p className="text-xs text-slate-400">{ACCOUNT_TYPE_LABELS[a.type]}</p>
                    </div>

                    {/* Balance + last updated */}
                    <div className="text-right mr-2">
                      <p
                        className={`text-sm font-bold tabular-nums ${
                          group.isLiability ? "text-red-600" : "text-slate-900"
                        }`}
                      >
                        {fmtFull(Math.abs(bal))}
                      </p>
                      <p className="text-xs text-slate-400">
                        {relativeTime(a.lastUpdated)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 flex-shrink-0">
                      {isPlaid ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => a.plaidItemId && handleSync(a.plaidItemId)}
                            disabled={isSyncing || deletingId === a.id}
                            className="h-7 w-7 p-0 text-indigo-500 hover:text-indigo-700"
                            title="Sync now"
                          >
                            {isSyncing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(a.id, true)}
                            disabled={isSyncing || deletingId === a.id}
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                            title="Disconnect bank account"
                          >
                            {deletingId === a.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(a)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                            title="Edit account"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(a.id, false)}
                            disabled={deletingId === a.id}
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                            title="Delete account"
                          >
                            {deletingId === a.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        );
      })}

      {/* Empty state */}
      {accounts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <p className="text-sm">No accounts yet</p>
          <p className="text-xs mt-1">Add an account or connect your bank to get started</p>
        </div>
      )}

      <AccountFormDialog
        open={addOpen || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setAddOpen(false);
            setEditing(null);
          }
        }}
        onSaved={handleSaved}
        initial={editing}
      />
    </div>
  );
}
