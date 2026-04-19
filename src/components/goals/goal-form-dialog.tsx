"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Account = { id: string; name: string; type: string; balance: string };

type GoalType = "savings" | "debt_payoff" | "emergency_fund";

export function GoalFormDialog({
  open,
  onOpenChange,
  onSaved,
  accounts,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  accounts: Account[];
}) {
  const [type, setType] = useState<GoalType>("savings");
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [linkedAccountId, setLinkedAccountId] = useState("");
  const [targetMonths, setTargetMonths] = useState("6");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          targetAmount: targetAmount ? parseFloat(targetAmount) : undefined,
          monthlyContribution: monthlyContribution ? parseFloat(monthlyContribution) : undefined,
          interestRate: interestRate ? parseFloat(interestRate) : undefined,
          targetDate: targetDate || undefined,
          linkedAccountId: linkedAccountId || undefined,
          targetMonths: type === "emergency_fund" ? parseInt(targetMonths) : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create goal");
      onSaved();
      onOpenChange(false);
      // reset
      setName(""); setTargetAmount(""); setMonthlyContribution("");
      setInterestRate(""); setTargetDate(""); setLinkedAccountId("");
    } finally {
      setSaving(false);
    }
  }

  const savingsAccounts = accounts.filter((a) =>
    ["savings", "checking", "investment", "retirement"].includes(a.type)
  );
  const debtAccounts = accounts.filter((a) => ["credit", "loan"].includes(a.type));
  const linkedOptions = type === "debt_payoff" ? debtAccounts : savingsAccounts;

  const fmtBal = (b: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
      Math.abs(parseFloat(b))
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Financial Goal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(["savings", "debt_payoff", "emergency_fund"] as GoalType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  type === t ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t === "savings" ? "Save" : t === "debt_payoff" ? "Pay Off Debt" : "Emergency Fund"}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Goal Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                type === "savings" ? "Vacation fund" : type === "debt_payoff" ? "Pay off Visa" : "Emergency fund"
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>

          {type === "emergency_fund" && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Target Months of Expenses</label>
              <input
                type="number" min="1" max="24"
                value={targetMonths}
                onChange={(e) => setTargetMonths(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          )}

          {type !== "emergency_fund" && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                {type === "debt_payoff" ? "Current Balance Owed ($)" : "Target Amount ($)"}
              </label>
              <input
                type="number" step="0.01" required
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="10000"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          )}

          {linkedOptions.length > 0 && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Linked Account <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <select
                value={linkedAccountId}
                onChange={(e) => setLinkedAccountId(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              >
                <option value="">— select account —</option>
                {linkedOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({fmtBal(a.balance)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Monthly Contribution ($)</label>
            <input
              type="number" step="0.01"
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(e.target.value)}
              placeholder="500"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>

          {type === "debt_payoff" && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Interest Rate (APR %)</label>
              <input
                type="number" step="0.01"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="24.99"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          )}

          {type === "savings" && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Target Date</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          )}

          <div className="flex gap-2 pt-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create Goal"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
