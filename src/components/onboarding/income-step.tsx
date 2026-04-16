"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function IncomeStep({ onNext }: { onNext: (income: number) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

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
        <h2 className="text-xl font-bold text-slate-900">What&apos;s your monthly income?</h2>
        <p className="text-sm text-slate-500 mt-1">
          After tax. This helps the AI set savings-friendly budget limits.
        </p>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Monthly income (after tax)</label>
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
            autoFocus
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
      <Button onClick={handleNext} className="w-full bg-indigo-600 hover:bg-indigo-700 h-11">
        Continue →
      </Button>
    </div>
  );
}
