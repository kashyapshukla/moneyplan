"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountFormDialog } from "./account-form-dialog";
import { ACCOUNT_TYPE_LABELS, LIABILITY_TYPES, AccountType, calcNetWorth } from "@/lib/account-types";
import { useRouter } from "next/navigation";

type Account = {
  id: string;
  name: string;
  type: AccountType;
  balance: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function AccountsList({ initialAccounts }: { initialAccounts: Account[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
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
              return (
                <div key={a.id} className="flex items-center justify-between rounded-lg border bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{a.name}</p>
                    <p className="text-xs text-slate-400">{ACCOUNT_TYPE_LABELS[a.type]}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold tabular-nums ${color}`}>
                      {fmt(Math.abs(bal))}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(a)} className="h-7 w-7 p-0">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
