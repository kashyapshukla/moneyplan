"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABELS, TransactionCategory } from "@/lib/categories";

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

// All categories available in the change-category dropdown
const CHANGEABLE_CATEGORIES = Object.keys(CATEGORY_LABELS) as TransactionCategory[];

interface PendingTransaction {
  id: string;
  description: string;
  amount: string;
  date: string;
  category: string;
  source: string;
}

export function VerificationPanel() {
  const [pending, setPending] = useState<PendingTransaction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const [total, setTotal] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [changingCategory, setChangingCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/transactions/pending-review")
      .then((r) => r.json())
      .then((data: PendingTransaction[]) => {
        if (!Array.isArray(data) || data.length === 0) {
          setLoading(false);
          return;
        }
        setPending(data);
        setTotal(data.length);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (pending.length === 0 && !allDone) return null;

  const current = pending[currentIndex];
  const progressPercent = total > 0 ? Math.round((reviewed / total) * 100) : 100;

  async function verify(id: string, category: string) {
    setSubmitting(true);
    await fetch("/api/transactions/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, category }),
    });
    setSubmitting(false);
    setChangingCategory(false);
    setSelectedCategory("");

    const nextReviewed = reviewed + 1;
    setReviewed(nextReviewed);

    if (currentIndex + 1 >= pending.length) {
      setAllDone(true);
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function handleLooksCorrect() {
    if (!current) return;
    verify(current.id, current.category);
  }

  function handleConfirmCategory() {
    if (!current || !selectedCategory) return;
    verify(current.id, selectedCategory);
  }

  const amountNum = current ? parseFloat(current.amount) : 0;
  const amountPositive = amountNum >= 0;
  const amountFormatted = current
    ? `${amountPositive ? "+" : ""}${amountNum.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      })}`
    : "";

  const catColor = current
    ? CATEGORY_COLORS[current.category] ?? "bg-slate-100 text-slate-700"
    : "";

  if (allDone) {
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white text-sm font-semibold">
          ✓
        </span>
        <div>
          <p className="font-semibold text-indigo-800 text-sm">All caught up!</p>
          <p className="text-indigo-600 text-xs">All {total} transactions have been reviewed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 bg-indigo-100">
        <div
          className="h-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="px-5 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Review Transactions
            </span>
          </div>
          <span className="text-xs text-slate-500">
            {reviewed} of {total} reviewed
          </span>
        </div>

        {current && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Transaction info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span
                  className={`text-xl font-bold tabular-nums ${
                    amountPositive ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {amountFormatted}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${catColor}`}
                >
                  {current.category}
                </span>
              </div>
              <p className="mt-0.5 text-sm font-medium text-slate-800 truncate">
                {current.description}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date(current.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 shrink-0">
              {!changingCategory ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLooksCorrect}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    <span>✓</span> Looks correct
                  </button>
                  <button
                    onClick={() => {
                      setChangingCategory(true);
                      setSelectedCategory(current.category);
                    }}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    <span>✗</span> Change category
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {CHANGEABLE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleConfirmCategory}
                    disabled={submitting || !selectedCategory}
                    className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => {
                      setChangingCategory(false);
                      setSelectedCategory("");
                    }}
                    disabled={submitting}
                    className="text-sm text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
