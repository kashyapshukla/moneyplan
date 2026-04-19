# Budget Setup Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI agent that analyses spending history, streams its reasoning via SSE, proposes an editable monthly budget, and applies it — accessible from both a new-user onboarding wizard and an "AI Suggest" button on the Budgets page.

**Architecture:** A single streaming API route (`POST /api/ai/suggest-budgets`) calls Gemini, parses its output into SSE events (`thinking` / `proposal` / `done` / `error`), and streams back to the client. A shared `<BudgetAgentPanel />` component consumes the stream and renders live reasoning text followed by editable budget rows. Two surfaces trigger this panel: a 3-step `<OnboardingWizard />` (new users) and an `<OnboardingBanner />` on the Budgets page (existing users with no budgets set).

**Tech Stack:** Next.js 14 App Router, Server-Sent Events via `TransformStream`, Gemini via Vertex AI (`gemini-2.5-flash-lite`), Drizzle ORM (existing `budgets` table), Tailwind CSS, TypeScript.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/gemini.ts` | Modify | Add `suggestBudgets()` — builds prompt, calls Gemini, streams SSE events |
| `src/lib/budgets.ts` | Modify | Add `getSpendingAverages()` — last 3 months avg per category |
| `src/app/api/ai/suggest-budgets/route.ts` | Create | POST handler — auth, fetch averages, call `suggestBudgets()`, return SSE stream |
| `src/components/onboarding/budget-agent-panel.tsx` | Create | Client component — consumes SSE stream, renders thinking text + editable rows |
| `src/components/onboarding/income-step.tsx` | Create | Step 1 of wizard — monthly income input |
| `src/components/onboarding/csv-step.tsx` | Create | Step 2 of wizard — CSV upload or skip |
| `src/components/onboarding/onboarding-wizard.tsx` | Create | 3-step wizard shell, manages step state |
| `src/app/(app)/onboarding/page.tsx` | Create | Route for new-user onboarding |
| `src/components/budgets/onboarding-banner.tsx` | Create | Banner shown on Budgets page when 0 budgets set |
| `src/app/(app)/budgets/page.tsx` | Modify | Render `<OnboardingBanner />` when no budgets |
| `src/app/(app)/layout.tsx` | Modify | Check onboarding_complete, redirect new users |

---

## Task 1: Add `getSpendingAverages()` to budgets lib

**Files:**
- Modify: `src/lib/budgets.ts`

- [ ] **Step 1: Add the function at the bottom of `src/lib/budgets.ts`**

```typescript
// Add after the existing deleteBudget function

export type SpendingAverages = {
  byCategory: Record<string, number>;   // avg monthly spend per expense category
  totalTransactions: number;            // total tx count across 3 months
  confidence: "high" | "low";          // high = >=10 tx, low = <10
};

export async function getSpendingAverages(
  userId: string
): Promise<SpendingAverages> {
  const now = new Date();
  const byCategory: Record<string, number> = {};
  let totalTransactions = 0;

  // Collect spending for each of the last 3 months
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const spending = await getSpendingByCategory(userId, month, year);
    for (const [cat, amt] of Object.entries(spending)) {
      byCategory[cat] = (byCategory[cat] ?? 0) + amt;
    }
  }

  // Count total transactions across 3 months
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, threeMonthsAgo),
        sql`${transactions.amount} < 0`
      )
    );
  totalTransactions = Number(countRow?.count ?? 0);

  // Average over 3 months
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat] = Math.round(byCategory[cat] / 3);
  }

  return {
    byCategory,
    totalTransactions,
    confidence: totalTransactions >= 10 ? "high" : "low",
  };
}
```

- [ ] **Step 2: Verify the import `transactions` is already in the file header**

Open `src/lib/budgets.ts` — the first import line should be:
```typescript
import { budgets, transactions } from "./schema";
```
It already is. No change needed.

- [ ] **Step 3: Commit**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
git add src/lib/budgets.ts
git commit -m "feat: add getSpendingAverages() to budgets lib"
```

---

## Task 2: Add `suggestBudgets()` streaming function to gemini lib

**Files:**
- Modify: `src/lib/gemini.ts`

- [ ] **Step 1: Add the types and function to `src/lib/gemini.ts`**

Append this to the end of `src/lib/gemini.ts`:

```typescript
// ── Budget suggestion types ──────────────────────────────────────────────────

export type ProposedBudget = {
  category: string;
  suggestedLimit: number;
  reasoning: string;
  source: "actual" | "rule";
};

export type BudgetSseEvent =
  | { type: "thinking"; text: string }
  | { type: "proposal"; budgets: ProposedBudget[] }
  | { type: "done" }
  | { type: "error"; message: string };

// ── suggestBudgets ────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  "Food", "Housing", "Transport", "Health", "Entertainment", "Shopping", "Other",
] as const;

export async function suggestBudgets({
  monthlyIncome,
  spendingAverages,
  confidence,
  onEvent,
}: {
  monthlyIncome: number;
  spendingAverages: Record<string, number>;
  confidence: "high" | "low";
  onEvent: (event: BudgetSseEvent) => void;
}): Promise<void> {
  const categoryLines = EXPENSE_CATEGORIES.map((cat) => {
    const avg = spendingAverages[cat];
    return avg
      ? `- ${cat}: $${avg}/month (actual average from last 3 months)`
      : `- ${cat}: no data`;
  }).join("\n");

  const prompt = `You are a personal finance AI helping set up a monthly budget.

User monthly income: $${monthlyIncome}
Spending history confidence: ${confidence} (${confidence === "high" ? ">=10 transactions" : "<10 transactions — lean on income-based rules"})

Last 3-month average spending by expense category:
${categoryLines}

Rules:
- Total budget limits must not exceed 80% of income ($${Math.round(monthlyIncome * 0.8)}) so the user saves at least 20%
- For categories WITH actual data and high confidence: stay within 10% of the actual average (round to nearest $10)
- For categories WITHOUT data or low confidence: use 50/30/20 framework — needs (Food, Housing, Transport, Health) get 50% of income split proportionally, wants (Entertainment, Shopping) get 30% split proportionally
- Housing is a "need". Food, Transport, Health are "needs". Entertainment, Shopping, Other are "wants"
- Always include all 7 expense categories (Food, Housing, Transport, Health, Entertainment, Shopping, Other)
- Round every limit to nearest $10

First, think through your reasoning for each category out loud (2-3 sentences each). Then output your final proposal inside <proposal> XML tags as a JSON array.

Example output format:
I'll start with Food. The user averaged $480/month over 3 months with high confidence data. I'll recommend $530 to give a small buffer...

<proposal>
[
  {"category":"Food","suggestedLimit":530,"reasoning":"Based on your $480 average spend, with a small buffer","source":"actual"},
  ...
]
</proposal>`;

  try {
    const res = await fetch(`${VERTEX_ENDPOINT}?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini suggest-budgets error:", errText);
      onEvent({ type: "error", message: "AI service unavailable. Please try again." });
      return;
    }

    const json = await res.json();
    const fullText: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!fullText) {
      onEvent({ type: "error", message: "Empty response from AI. Please try again." });
      return;
    }

    // Split thinking from proposal
    const proposalMatch = fullText.match(/<proposal>([\s\S]*?)<\/proposal>/);
    const thinkingText = proposalMatch
      ? fullText.slice(0, fullText.indexOf("<proposal>")).trim()
      : fullText;

    // Stream thinking text word by word (simulate streaming since Gemini non-streaming)
    const words = thinkingText.split(" ");
    for (let i = 0; i < words.length; i += 5) {
      onEvent({ type: "thinking", text: words.slice(i, i + 5).join(" ") + " " });
      // tiny yield to allow SSE flush
      await new Promise((r) => setTimeout(r, 30));
    }

    if (!proposalMatch) {
      onEvent({ type: "error", message: "AI did not return a budget proposal. Please try again." });
      return;
    }

    const rawJson = proposalMatch[1].trim();
    const parsed = JSON.parse(rawJson) as ProposedBudget[];

    // Validate all 7 categories present
    const validCategories = new Set(EXPENSE_CATEGORIES as readonly string[]);
    const filtered = parsed.filter((b) => validCategories.has(b.category));

    onEvent({ type: "proposal", budgets: filtered });
    onEvent({ type: "done" });
  } catch (err) {
    console.error("suggestBudgets error:", err);
    onEvent({ type: "error", message: "Something went wrong generating your budget." });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/gemini.ts
git commit -m "feat: add suggestBudgets() streaming function to gemini lib"
```

---

## Task 3: Create the SSE API route

**Files:**
- Create: `src/app/api/ai/suggest-budgets/route.ts`

- [ ] **Step 1: Create directories**

```bash
mkdir -p "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal/src/app/api/ai/suggest-budgets"
```

- [ ] **Step 2: Create `src/app/api/ai/suggest-budgets/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { getSpendingAverages } from "@/lib/budgets";
import { suggestBudgets, BudgetSseEvent } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await req.json();
  const monthlyIncome = Number(body.monthlyIncome);

  if (!monthlyIncome || monthlyIncome <= 0) {
    return new Response(JSON.stringify({ error: "monthlyIncome is required" }), { status: 400 });
  }

  // Get spending history
  const { byCategory, confidence } = await getSpendingAverages(session.user.id);

  // Set up SSE stream
  const encoder = new TextEncoder();
  const stream = new TransformStream<string, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(encoder.encode(chunk));
    },
  });

  const writer = stream.writable.getWriter();

  function sendEvent(event: BudgetSseEvent) {
    writer.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  // Run agent in background, stream events
  suggestBudgets({
    monthlyIncome,
    spendingAverages: byCategory,
    confidence,
    onEvent: sendEvent,
  }).finally(() => {
    writer.close();
  });

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/ai/suggest-budgets/"
git commit -m "feat: add POST /api/ai/suggest-budgets SSE route"
```

---

## Task 4: Build `<BudgetAgentPanel />`

**Files:**
- Create: `src/components/onboarding/budget-agent-panel.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal/src/components/onboarding"
```

- [ ] **Step 2: Create `src/components/onboarding/budget-agent-panel.tsx`**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import type { ProposedBudget } from "@/lib/gemini";
import { CATEGORY_LABELS } from "@/lib/transactions";

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
  }, []);

  async function startAgent() {
    setAgentState("loading");
    setThinkingText("");
    setProposals([]);
    setErrorMsg("");

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
            } else if (event.type === "done") {
              // handled by proposal_ready
            } else if (event.type === "error") {
              setErrorMsg(event.message);
              setAgentState("error");
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch (err) {
      setErrorMsg("Network error. Please try again.");
      setAgentState("error");
    }
  }

  async function applyBudgets() {
    setAgentState("applying");
    let applied = 0;

    for (const proposal of proposals) {
      const limit = editedLimits[proposal.category] ?? proposal.suggestedLimit;
      await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: proposal.category,
          monthlyLimit: limit,
          month,
          year,
        }),
      });
      applied++;
      setApplyProgress(Math.round((applied / proposals.length) * 100));
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
```

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/
git commit -m "feat: add BudgetAgentPanel component with SSE stream consumer"
```

---

## Task 5: Build onboarding wizard steps

**Files:**
- Create: `src/components/onboarding/income-step.tsx`
- Create: `src/components/onboarding/csv-step.tsx`
- Create: `src/components/onboarding/onboarding-wizard.tsx`

- [ ] **Step 1: Create `src/components/onboarding/income-step.tsx`**

```typescript
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
        <h2 className="text-xl font-bold text-slate-900">What's your monthly income?</h2>
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
```

- [ ] **Step 2: Create `src/components/onboarding/csv-step.tsx`**

```typescript
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, ArrowRight } from "lucide-react";

export function CsvStep({ onNext }: { onNext: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/transactions/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      setUploaded(true);
    } catch {
      setError("Upload failed. You can skip and add transactions manually later.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Import your transactions</h2>
        <p className="text-sm text-slate-500 mt-1">
          Upload a bank CSV so the AI can build a budget based on your real spending. You can skip this and do it later.
        </p>
      </div>

      <div
        className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-300 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-8 w-8 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-600">
          {uploaded ? "✅ Transactions imported!" : "Click to upload a CSV file"}
        </p>
        <p className="text-xs text-slate-400 mt-1">Supports exports from most banks</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onNext} className="flex-1">
          Skip for now
        </Button>
        <Button
          onClick={onNext}
          disabled={uploading}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700"
        >
          {uploading ? "Uploading..." : uploaded ? "Continue →" : <><ArrowRight className="h-4 w-4 mr-1" /> Continue</>}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/onboarding/onboarding-wizard.tsx`**

```typescript
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
```

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/
git commit -m "feat: add onboarding wizard steps (income, csv, agent panel)"
```

---

## Task 6: Create the onboarding page route

**Files:**
- Create: `src/app/(app)/onboarding/page.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal/src/app/(app)/onboarding"
```

- [ ] **Step 2: Create `src/app/(app)/onboarding/page.tsx`**

```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  return <OnboardingWizard />;
}
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/onboarding/"
git commit -m "feat: add /onboarding page route"
```

---

## Task 7: Add onboarding redirect to app layout

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Replace `src/app/(app)/layout.tsx` with a version that includes the redirect**

The layout needs to become a client component wrapper so it can check `localStorage`. We'll keep the server-rendered shell and add a client component just for the redirect check.

First create `src/components/layout/onboarding-guard.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export function OnboardingGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Only check on first render, not on the onboarding page itself
    if (pathname === "/onboarding") return;

    const done = localStorage.getItem("onboarding_complete");
    if (!done) {
      router.replace("/onboarding");
    }
  }, [pathname, router]);

  return null;
}
```

- [ ] **Step 2: Modify `src/app/(app)/layout.tsx` to render `<OnboardingGuard />`**

```typescript
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { OnboardingGuard } from "@/components/layout/onboarding-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50">
      <OnboardingGuard />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/onboarding-guard.tsx src/app/(app)/layout.tsx
git commit -m "feat: add OnboardingGuard — redirect new users to onboarding wizard"
```

---

## Task 8: Add `<OnboardingBanner />` to the Budgets page

**Files:**
- Create: `src/components/budgets/onboarding-banner.tsx`
- Modify: `src/app/(app)/budgets/page.tsx`

- [ ] **Step 1: Create `src/components/budgets/onboarding-banner.tsx`**

```typescript
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
```

- [ ] **Step 2: Modify `src/app/(app)/budgets/page.tsx`** to import and render `<OnboardingBanner />`

Replace the full file content:

```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listBudgetsWithSpending } from "@/lib/budgets";
import { BudgetsList } from "@/components/budgets/budgets-list";
import { MonthNav } from "@/components/budgets/month-nav";
import { OnboardingBanner } from "@/components/budgets/onboarding-banner";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const now = new Date();
  const month = parseInt(searchParams.month ?? String(now.getMonth() + 1));
  const year = parseInt(searchParams.year ?? String(now.getFullYear()));

  const budgets = await listBudgetsWithSpending(session.user.id, month, year);

  const monthName = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Budgets</h1>
          <p className="text-sm text-slate-500 mt-1">Set monthly limits per category</p>
        </div>
        <MonthNav month={month} year={year} />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-600">{monthName}</span>
        {month === now.getMonth() + 1 && year === now.getFullYear() && (
          <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">
            Current Month
          </span>
        )}
      </div>

      {budgets.length === 0 && (
        <OnboardingBanner month={month} year={year} />
      )}

      <BudgetsList initialBudgets={budgets} month={month} year={year} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/budgets/onboarding-banner.tsx "src/app/(app)/budgets/page.tsx"
git commit -m "feat: add OnboardingBanner to Budgets page with inline AI budget setup"
```

---

## Task 9: Add roadmap doc and push to GitHub

**Files:**
- Create: `docs/superpowers/specs/roadmap.md`

- [ ] **Step 1: Create `docs/superpowers/specs/roadmap.md`**

```markdown
# MoneyPlan — Agentic Features Roadmap

| Phase | Feature | Status |
|---|---|---|
| 1 | Budget Setup Agent | ✅ Complete |
| 2 | Tool-Calling AI Chat | 📋 Planned |
| 3 | Proactive Smart Alerts | 📋 Planned |
| 4 | Financial Goals Agent | 📋 Planned |

## Phase 1: Budget Setup Agent
AI analyses 3 months of spending history, streams reasoning via SSE, proposes editable monthly budgets, applies them in one click. Accessible from new-user onboarding wizard and Budgets page banner.

## Phase 2: Tool-Calling AI Chat
Extend the existing AI Chat with real tools the agent can call: `createTransaction`, `upsertBudget`, `createAccount`, `getSpendingReport`, `createGoal`. User says "Add $45 Uber Eats from yesterday" and it happens.

## Phase 3: Proactive Smart Alerts
Agent monitors spending after each transaction is added. When a budget hits 80% or is exceeded, surface an alert card on the Dashboard with one-click remediation options (increase budget, get tips, dismiss).

## Phase 4: Financial Goals Agent
User sets a goal (e.g. "Save $10k by December"). Agent creates a monthly savings plan, adjusts budgets to support it, tracks progress, and surfaces insights when the user is ahead or behind.
```

- [ ] **Step 2: Push everything to GitHub**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
git add docs/
git commit -m "docs: add agentic roadmap and budget agent design spec"
git push origin claude/lucid-pascal
git push origin claude/lucid-pascal:main
```

- [ ] **Step 3: Verify no secrets are in git history**

```bash
git log --oneline -5
git show HEAD --stat
# Confirm: no .env files, no .claude/ directory in any changed files
```

---

## Self-Review

**Spec coverage check:**
- ✅ `POST /api/ai/suggest-budgets` SSE route — Task 3
- ✅ `getSpendingAverages()` with confidence scoring — Task 1
- ✅ `suggestBudgets()` Gemini streaming function — Task 2
- ✅ `<BudgetAgentPanel />` with SSE consumer, editable rows, apply — Task 4
- ✅ 3-step onboarding wizard (income → CSV → agent) — Task 5
- ✅ `/onboarding` page route — Task 6
- ✅ `<OnboardingGuard />` redirect for new users — Task 7
- ✅ `<OnboardingBanner />` on Budgets page — Task 8
- ✅ Roadmap doc — Task 9
- ✅ Hybrid confidence scoring (high/low, actuals vs rules) — Task 1 + 2
- ✅ Inline editable limits with live total/savings — Task 4
- ✅ Error handling (Gemini down, empty response, no income) — Tasks 2, 3, 4

**Type consistency check:**
- `ProposedBudget` defined in `src/lib/gemini.ts` Task 2, imported in `budget-agent-panel.tsx` Task 4 ✅
- `BudgetSseEvent` defined in `src/lib/gemini.ts` Task 2, used in `route.ts` Task 3 ✅
- `SpendingAverages` defined in `src/lib/budgets.ts` Task 1, destructured in `route.ts` Task 3 ✅
- `onDone?: () => void` prop defined in Task 4, used in Task 5 (`handleAgentDone`) and Task 8 (`handleDone`) ✅
