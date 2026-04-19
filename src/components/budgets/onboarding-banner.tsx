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
  const router = useRouter();

  if (showAgent) {
    return (
      <BudgetAgentPanel
        month={month}
        year={year}
        onDone={() => router.refresh()}
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
              Let AI analyse your income and spending history to suggest personalised limits in seconds.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowAgent(true)}
            className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
          >
            🤖 Set up with AI
          </Button>
        </div>
      </div>
    </div>
  );
}
