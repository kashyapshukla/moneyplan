"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import type { ProposedBudget } from "@/lib/gemini";
import { CATEGORY_LABELS } from "@/lib/categories";

type AgentState =
  | "idle"
  | "loading"
  | "thinking"
  | "proposal_ready"
  | "applying"
  | "done"
  | "error";

const CATEGORY_ICONS: Record<string, string> = {
  Food: "🍔", Housing: "🏠", Transport: "🚗",
  Health: "🏥", Entertainment: "🎭", Shopping: "🛍", Other: "📦",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function BudgetAgentPanel({
  monthlyIncome,
  month,
  year,
  onDone,
}: {
  monthlyIncome: number;
  month: number;
  year: number;
  onDone?: () => void;
}) {
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [thinkingText, setThinkingText] = useState("");
  const [proposals, setProposals] = useState<ProposedBudget[]>([]);
  const [editedLimits, setEditedLimits] = useState<Record<string, number>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [applyProgress, setApplyProgress] = useState(0);
  const thinkingRef = useRef<HTMLDivElement>(null);

  // Auto-scroll thinking text
  useEffect(() => {
    if (thinkingRef.current) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [thinkingText]);

  useEffect(() => {
    startAgent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startAgent() {
    setAgentState("loading");
    setThinkingText("");
    setProposals([]);
    setErrorMsg("");
    setApplyProgress(0);

    try {
      const res = await fetch("/api/ai/suggest-budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyIncome, month, year }),
      });

      if (!res.ok || !res.body) {
        setErrorMsg("Could not reach the AI service.");
        setAgentState("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      setAgentState("thinking");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw);
            if (event.type === "thinking") {
              setThinkingText((prev) => prev + event.text);
            } else if (event.type === "proposal") {
              const limits: Record<string, number> = {};
              for (const b of event.budgets) {
                limits[b.category] = b.suggestedLimit;
              }
              setProposals(event.budgets);
              setEditedLimits(limits);
              setAgentState("proposal_ready");
            } else if (event.type === "error") {
              setErrorMsg(event.message);
              setAgentState("error");
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setAgentState("error");
    }
  }

  async function applyBudgets() {
    setAgentState("applying");
    let applied = 0;

    let failed = 0;
    for (const proposal of proposals) {
      const limit = editedLimits[proposal.category] ?? proposal.suggestedLimit;
      try {
        const res = await fetch("/api/budgets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: proposal.category,
            monthlyLimit: limit,
            month,
            year,
          }),
        });
        if (!res.ok) failed++;
      } catch {
        failed++;
      }
      applied++;
      setApplyProgress(Math.round((applied / proposals.length) * 100));
    }

    if (failed > 0) {
      setErrorMsg(`${failed} budget(s) failed to save. Please try again or set them manually.`);
      setAgentState("error");
      return;
    }

    setAgentState("done");
    setTimeout(() => onDone?.(), 800);
  }

  const totalBudgeted = proposals.reduce(
    (sum, p) => sum + (editedLimits[p.category] ?? p.suggestedLimit),
    0
  );
  const projectedSavings = monthlyIncome - totalBudgeted;

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b bg-slate-50">
        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-lg">🤖</div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Budget Setup Agent</p>
          <p className="text-xs text-slate-400">
            {agentState === "loading" && "Connecting to AI..."}
            {agentState === "thinking" && "Analysing your spending..."}
            {agentState === "proposal_ready" && "Ready — review and apply"}
            {agentState === "applying" && `Applying budgets... ${applyProgress}%`}
            {agentState === "done" && "All budgets applied ✓"}
            {agentState === "error" && "Something went wrong"}
          </p>
        </div>
        {(agentState === "loading" || agentState === "thinking" || agentState === "applying") && (
          <Loader2 className="h-4 w-4 animate-spin text-indigo-400 ml-auto" />
        )}
        {agentState === "done" && (
          <CheckCircle2 className="h-5 w-5 text-emerald-500 ml-auto" />
        )}
      </div>

      {/* Thinking text */}
      {(agentState === "thinking" || agentState === "proposal_ready") && thinkingText && (
        <div
          ref={thinkingRef}
          className="px-5 py-4 max-h-36 overflow-y-auto bg-indigo-50 border-b"
        >
          <p className="text-xs text-indigo-700 leading-relaxed font-mono whitespace-pre-wrap">
            {thinkingText}
          </p>
        </div>
      )}

      {/* Error state */}
      {agentState === "error" && (
        <div className="px-5 py-6 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto" />
          <p className="text-sm text-slate-600">{errorMsg}</p>
          <Button variant="outline" size="sm" onClick={startAgent}>Try Again</Button>
        </div>
      )}

      {/* Proposal table */}
      {(agentState === "proposal_ready" || agentState === "applying" || agentState === "done") &&
        proposals.length > 0 && (
          <div className="divide-y">
            {proposals.map((p) => (
              <div key={p.category} className="flex items-center gap-4 px-5 py-3">
                <span className="text-lg w-7 flex-shrink-0">{CATEGORY_ICONS[p.category] ?? "📦"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {CATEGORY_LABELS[p.category as keyof typeof CATEGORY_LABELS] ?? p.category}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{p.reasoning}</p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    p.source === "actual"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {p.source === "actual" ? "actual" : "rule"}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={editedLimits[p.category] ?? p.suggestedLimit}
                    onChange={(e) =>
                      setEditedLimits((prev) => ({
                        ...prev,
                        [p.category]: Number(e.target.value),
                      }))
                    }
                    disabled={agentState !== "proposal_ready"}
                    className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm text-right outline-none focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Footer */}
      {agentState === "proposal_ready" && proposals.length > 0 && (
        <div className="px-5 py-4 border-t bg-slate-50 flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{fmt(totalBudgeted)}</span> budgeted
            &nbsp;·&nbsp;
            <span className={`font-semibold ${projectedSavings >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {fmt(Math.abs(projectedSavings))} {projectedSavings >= 0 ? "saved" : "over"}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={startAgent}>
              Regenerate
            </Button>
            <Button size="sm" onClick={applyBudgets} className="bg-indigo-600 hover:bg-indigo-700">
              Apply All Budgets →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
