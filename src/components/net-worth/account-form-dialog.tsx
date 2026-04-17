"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ACCOUNT_TYPE_LABELS, AccountType } from "@/lib/account-types";

const ACCOUNT_TYPES = Object.entries(ACCOUNT_TYPE_LABELS) as [AccountType, string][];

type Account = {
  id?: string;
  name: string;
  type: AccountType;
  balance: string;
};

export function AccountFormDialog({
  open,
  onOpenChange,
  onSaved,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSaved: (account: any) => void;
  initial?: Account | null;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    type: initial?.type ?? ("checking" as AccountType),
    balance: initial?.balance ?? "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/accounts", {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: initial?.id, ...form }),
      });
      const account = await res.json();
      onSaved(account);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Account" : "Add Account"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Account Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Chase Checking"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AccountType }))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              {ACCOUNT_TYPES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Current Balance ($)</label>
            <input
              type="number"
              required
              step="0.01"
              value={form.balance}
              onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
              placeholder="e.g. 5000.00 (use negative for debts)"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <p className="text-xs text-slate-400">
            Use a negative value for credit cards and loans (e.g. -2500)
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : initial?.id ? "Save Changes" : "Add Account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
