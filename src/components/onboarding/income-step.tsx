"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp } from "lucide-react";

export function IncomeStep({ onNext }: { onNext: (income: number) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [detecting, setDetecting] = useState(true);
  const [detected, setDetected] = useState<{ amount: number; months: number } | null>(null);

  useEffect(() => {
    fetch("/api/income")
      .then((r) => r.json())
      .then((data) => {
        if (data.monthlyIncome && data.monthlyIncome > 0) {
          setDetected({ amount: data.monthlyIncome, months: data.monthsUsed });
          setValue(String(data.monthlyIncome));
        }
      })
      .catch(() => {/* silent — user can enter manually */})
      .finally(() => setDetecting(false));
  }, []);

  function handleNext() {
    const n = parseFloat(value);
    if (!n || n <= 0) {
      setError("Please enter a valid monthly income.");
      return;
    }
    onNext(n);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Your monthly income</h2>
        <p className="text-sm text-slate-500 mt-1">
          After tax. Used to set savings-friendly budget limits.
        </p>
      </div>

      {/* Auto-detect status */}
      {detecting && (
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-lg px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          Calculating from your transaction history…
        </div>
      )}

      {!detecting && detected && (
        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
          <TrendingUp className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-indigo-800">
              Detected ${detected.amount.toLocaleString()}/month
            </p>
            <p className="text-indigo-600 text-xs mt-0.5">
              Averaged from {detected.months} month{detected.months !== 1 ? "s" : ""} of incoming transactions. You can adjust below.
            </p>
          </div>
        </div>
      )}

      {!detecting && !detected && (
        <div className="text-sm text-slate-500 bg-slate-50 rounded-lg px-4 py-3">
          No income transactions found yet — enter your monthly take-home pay below.
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          Monthly income (after tax)
        </label>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-lg font-medium">$</span>
          <input
            type="number"
            min={0}
            step={100}
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(""); }}
            placeholder="e.g. 4200"
            className="flex-1 rounded-lg border border-slate-200 px-4 py-3 text-lg outline-none focus:border-indigo-400"
            onKeyDown={(e) => e.key === "Enter" && handleNext()}
            disabled={detecting}
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      <Button
        onClick={handleNext}
        disabled={detecting}
        className="w-full bg-indigo-600 hover:bg-indigo-700 h-11"
      >
        Continue →
      </Button>
    </div>
  );
}
