"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IncomeStep } from "./income-step";
import { CsvStep } from "./csv-step";
import { BudgetAgentPanel } from "./budget-agent-panel";

export function OnboardingWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const router = useRouter();

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  function handleIncomeDone(income: number) {
    setMonthlyIncome(income);
    setStep(2);
  }

  function handleCsvDone() {
    setStep(3);
  }

  function handleAgentDone() {
    localStorage.setItem("onboarding_complete", "1");
    router.push("/budgets");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Logo + step indicator */}
        <div className="text-center mb-8">
          <p className="text-2xl font-bold text-slate-900 mb-1">💰 MoneyPlan</p>
          <p className="text-sm text-slate-400">Step {step} of 3</p>
          <div className="flex gap-2 justify-center mt-3">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 w-12 rounded-full transition-colors ${
                  s <= step ? "bg-indigo-500" : "bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          {step === 1 && <IncomeStep onNext={handleIncomeDone} />}
          {step === 2 && <CsvStep onNext={handleCsvDone} />}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Your personalised budget</h2>
                <p className="text-sm text-slate-500 mt-1">
                  The AI is analysing your spending and building a budget. Edit any amount, then apply.
                </p>
              </div>
              <BudgetAgentPanel
                monthlyIncome={monthlyIncome}
                month={month}
                year={year}
                onDone={handleAgentDone}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
