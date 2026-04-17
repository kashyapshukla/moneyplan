"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const CATEGORIES = [
  "Food", "Housing", "Transport", "Health",
  "Entertainment", "Shopping", "Income", "Other",
];

type Transaction = {
  id?: string;
  date: Date | string;
  description: string;
  amount: string;
  category: string;
};

export function AddTransactionDialog({
  open,
  onOpenChange,
  onSaved,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (tx: any) => void;
  initial?: Transaction | null;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    date: initial?.date
      ? new Date(initial.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    description: initial?.description ?? "",
    amount: initial?.amount ?? "",
    category: initial?.category ?? "Other",
  });

  // AI suggestion state
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset form when dialog opens with new initial value
  useEffect(() => {
    setForm({
      date: initial?.date
        ? new Date(initial.date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      description: initial?.description ?? "",
      amount: initial?.amount ?? "",
      category: initial?.category ?? "Other",
    });
    setAiSuggested(false);
  }, [open, initial?.id]);

  // Debounced AI category suggestion
  useEffect(() => {
    // Skip for edits (initial already has a category)
    if (initial?.id) return;
    if (form.description.length < 3) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setAiSuggesting(true);
      try {
        const res = await fetch("/api/ai/suggest-category", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: form.description, amount: form.amount }),
        });
        if (!res.ok) return;
        const { category } = await res.json();
        if (category && CATEGORIES.includes(category)) {
          setForm((f) => ({ ...f, category }));
          setAiSuggested(true);
        }
      } catch {
        // silent — user can pick manually
      } finally {
        setAiSuggesting(false);
      }
    }, 700);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.description]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: initial?.id, ...form }),
      });
      const tx = await res.json();
      onSaved(tx);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Date</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Description</label>
            <input
              type="text"
              required
              value={form.description}
              onChange={(e) => {
                setAiSuggested(false);
                setForm((f) => ({ ...f, description: e.target.value }));
              }}
              placeholder="e.g. Starbucks coffee"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Amount</label>
            <input
              type="number"
              required
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="e.g. -12.50 (negative = expense)"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Category</label>
              {aiSuggesting && (
                <span className="flex items-center gap-1 text-xs text-violet-500">
                  <Sparkles className="h-3 w-3 animate-pulse" />
                  Suggesting…
                </span>
              )}
              {aiSuggested && !aiSuggesting && (
                <span className="flex items-center gap-1 text-xs text-violet-500">
                  <Sparkles className="h-3 w-3" />
                  AI suggested
                </span>
              )}
            </div>
            <select
              value={form.category}
              onChange={(e) => {
                setAiSuggested(false);
                setForm((f) => ({ ...f, category: e.target.value }));
              }}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : initial?.id ? "Save Changes" : "Add Transaction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
