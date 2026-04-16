"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BudgetAgentPanel } from "@/components/onboarding/budget-agent-panel";
import { useRouter } from "next/navigation";

export function OnboardingBanner({
  month,
  year,
}: {
  month: number;
  year: number;
}) {
  const [showAgent, setShowAgent] = useState(false);
  const [income, setIncome] = useState("");
  const [incomeSet, setIncomeSet] = useState(false);
  const [incomeError, setIncomeError] = useState("");
  const router = useRouter();

  function handleSetIncome() {
    const n = parseFloat(income);
    if (!n || n <= 0) {
      setIncomeError("Enter a valid income amount.");
      return;
    }
    setIncomeSet(true);
    setShowAgent(true);
  }

  function handleDone() {
    router.refresh();
  }

  if (showAgent && incomeSet) {
    return (
      <BudgetAgentPanel
        monthlyIncome={parseFloat(income)}
        month={month}
        year={year}
        onDone={handleDone}
      />
    );
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 p-6">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-5 w-5 text-indigo-600" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">No budgets set for this month</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Let the AI analyse your spending history and suggest personalised limits in seconds.
            </p>
          </div>
          {!showAgent && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  placeholder="Monthly income"
                  value={income}
                  onChange={(e) => { setIncome(e.target.value); setIncomeError(""); }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-400 w-40"
                  onKeyDown={(e) => e.key === "Enter" && handleSetIncome()}
                />
              </div>
              <Button
                size="sm"
                onClick={handleSetIncome}
                className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
              >
                🤖 Set up with AI
              </Button>
              {incomeError && <p className="text-xs text-red-500 w-full">{incomeError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
