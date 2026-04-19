"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddTransactionDialog } from "./add-transaction-dialog";

type Transaction = {
  id: string;
  date: Date | string;
  description: string;
  amount: string;
  category: string;
  source: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  Food: "bg-orange-100 text-orange-700",
  Housing: "bg-blue-100 text-blue-700",
  Transport: "bg-yellow-100 text-yellow-700",
  Health: "bg-green-100 text-green-700",
  Entertainment: "bg-purple-100 text-purple-700",
  Shopping: "bg-pink-100 text-pink-700",
  Income: "bg-emerald-100 text-emerald-700",
  Investment: "bg-indigo-100 text-indigo-700",
  Savings: "bg-teal-100 text-teal-700",
  Transfer: "bg-sky-100 text-sky-700",
  Other: "bg-slate-100 text-slate-700",
};

export function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  const [data, setData] = useState(transactions);
  const [editing, setEditing] = useState<Transaction | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction?")) return;
    await fetch("/api/transactions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setData((prev) => prev.filter((t) => t.id !== id));
  }

  function handleSaved(updated: Transaction) {
    setData((prev) =>
      editing ? prev.map((t) => (t.id === updated.id ? updated : t)) : [updated, ...prev]
    );
    setEditing(null);
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border bg-white py-20 text-slate-400">
        <p className="text-lg font-medium">No transactions yet</p>
        <p className="text-sm mt-1">Upload a CSV or add one manually</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((tx) => {
              const amount = parseFloat(tx.amount);
              const isIncome = amount > 0;
              return (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(tx.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 max-w-xs truncate">
                    {tx.description}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[tx.category] ?? CATEGORY_COLORS.Other}`}>
                      {tx.category}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-medium tabular-nums ${isIncome ? "text-emerald-600" : "text-slate-900"}`}>
                    {isIncome ? "+" : ""}${Math.abs(amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs capitalize">
                    {tx.source.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(tx)} className="h-7 w-7 p-0">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(tx.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <AddTransactionDialog
          open={!!editing}
          onOpenChange={(open) => { if (!open) setEditing(null); }}
          onSaved={handleSaved}
          initial={editing}
        />
      )}
    </>
  );
}
