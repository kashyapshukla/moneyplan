"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS } from "@/lib/categories";

const EXPENSE_CATEGORIES = Object.entries(CATEGORY_LABELS).filter(
  ([key]) => key !== "Income" && key !== "Health" && key !== "Transfer"
) as [string, string][];

type Budget = {
  id?: string;
  category: string;
  monthlyLimit: string;
};

export function BudgetFormDialog({
  open,
  onOpenChange,
  onSaved,
  initial,
  month,
  year,
  existingCategories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSaved: (budget: any) => void;
  initial?: Budget | null;
  month: number;
  year: number;
  existingCategories: string[];
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    category: initial?.category ?? EXPENSE_CATEGORIES[0][0],
    monthlyLimit: initial?.monthlyLimit ? String(parseFloat(initial.monthlyLimit)) : "",
  });

  // Sync form whenever the dialog opens for a different budget
  useEffect(() => {
    setForm({
      category: initial?.category ?? EXPENSE_CATEGORIES[0][0],
      monthlyLimit: initial?.monthlyLimit ? String(parseFloat(initial.monthlyLimit)) : "",
    });
  }, [initial]);

  const availableCategories = initial
    ? EXPENSE_CATEGORIES
    : EXPENSE_CATEGORIES.filter(([key]) => !existingCategories.includes(key));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          monthlyLimit: parseFloat(form.monthlyLimit),
          month,
          year,
        }),
      });
      const budget = await res.json();
      onSaved(budget);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Budget" : "Set Budget"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              disabled={!!initial?.id}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
            >
              {availableCategories.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Monthly Limit ($)</label>
            <input
              type="number"
              required
              min="1"
              step="0.01"
              value={form.monthlyLimit}
              onChange={(e) => setForm((f) => ({ ...f, monthlyLimit: e.target.value }))}
              placeholder="e.g. 500"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : initial?.id ? "Save Changes" : "Set Budget"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
