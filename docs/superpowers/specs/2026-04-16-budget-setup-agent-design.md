# Budget Setup Agent — Design Spec

**Date:** 2026-04-16  
**Status:** Approved  
**Part of roadmap:** Phase 1 of 4 agentic features

---

## Context

MoneyPlan already has a working budgets module (monthly limits per category, progress bars, CRUD). The problem: users have to set budgets manually. This feature adds an AI agent that analyses spending history, reasons about what limits make sense, and proposes a complete budget — which the user can edit inline and apply in one click.

---

## Goals

- New users get a guided 3-step onboarding wizard that ends with a budget proposal
- Existing users get an "AI Suggest" button on the Budgets page when no budgets are set for the month
- Both surfaces use the same `<BudgetAgentPanel />` component and the same streaming API endpoint
- The agent streams its reasoning visibly so the user understands *why* each limit was chosen
- User can edit any suggested amount inline before applying
- Budgets land in the existing `budgets` DB table — no new tables needed

---

## Out of Scope

- Persistent agent memory across sessions
- Push notifications / email alerts (Phase 3 — Smart Alerts)
- Financial Goals (Phase 4)
- The card-based wizard with progress bar (deferred to future — start with minimal 3-step flow)

---

## Architecture

```
User (browser)
  │
  ├─ /onboarding page (new users)
  │    Step 1: monthly income input
  │    Step 2: CSV upload or skip
  │    Step 3: <BudgetAgentPanel /> → edit → apply
  │
  └─ /budgets page (existing users)
       <OnboardingBanner /> → click → <BudgetAgentPanel /> expands inline

Both surfaces call:
  POST /api/ai/suggest-budgets  (streaming, Server-Sent Events)
    │
    ├─ getSpendingByCategory() — last 3 months
    ├─ Assess data confidence (< 10 transactions → "low data")
    ├─ Call Gemini with function-calling, stream response
    └─ Emit SSE events → client

On apply:
  POST /api/budgets (existing endpoint, one call per category)
```

---

## API — `POST /api/ai/suggest-budgets`

**Request body:**
```ts
{
  monthlyIncome: number   // required
  month: number           // 1–12, defaults to current month
  year: number            // defaults to current year
}
```

**Server logic (in order):**
1. Auth check — 401 if not signed in
2. Fetch last 3 months of transactions, group by category via `getSpendingByCategory()`
3. Calculate average monthly spend per category
4. Determine data confidence:
   - `>= 10 transactions` → "high" → weight actuals at 80%, income rules at 20%
   - `< 10 transactions` → "low" → weight actuals at 20%, income rules at 80%
5. Build Gemini prompt with both signals (actuals + income + 50/30/20 rule framework)
6. Stream Gemini response via `TransformStream` + `text/event-stream`
7. Parse and emit structured SSE events

**SSE event types:**
```ts
{ type: "thinking",  text: string }                          // streamed reasoning
{ type: "proposal",  budgets: ProposedBudget[] }             // final proposal
{ type: "done" }
{ type: "error",     message: string }
```

**ProposedBudget shape:**
```ts
{
  category: TransactionCategory
  suggestedLimit: number
  reasoning: string          // 1 sentence, shown as tooltip
  source: "actual" | "rule"  // shown as badge in UI
}
```

---

## Client State Machine

```
idle → loading → thinking → proposal_ready → editing → applying → done
                                                ↑           │
                                                └───────────┘  (user edits re-enter editing)
```

- `idle` → user clicks "Set up with AI" or lands on onboarding step 3
- `loading` → POST fired, waiting for first SSE event
- `thinking` → streaming `thinking` events, appending to reasoning textarea
- `proposal_ready` → `proposal` event received, editable rows rendered
- `editing` → user modifies any amount; total recalculates live
- `applying` → "Apply All" clicked, calls `POST /api/budgets` for each category sequentially
- `done` → success toast, redirect to `/budgets` (or next onboarding step)

---

## UI Components

### 1. `/src/app/(app)/onboarding/page.tsx`
- New route, server component, checks session (redirect to `/sign-in` if not authed)
- Renders `<OnboardingWizard />` client component
- After completion sets `localStorage.setItem('onboarding_complete', '1')` and redirects to `/dashboard`

### 2. `<OnboardingWizard />` — `src/components/onboarding/onboarding-wizard.tsx`
- Client component, manages `step: 1 | 2 | 3` state
- Step 1: `<IncomeStep />` — number input for monthly income, stored in local state
- Step 2: `<CsvStep />` — reuses existing CSV upload logic; "Skip" advances to step 3
- Step 3: `<BudgetAgentPanel monthlyIncome={income} month={m} year={y} onDone={...} />`

### 3. `<BudgetAgentPanel />` — `src/components/onboarding/budget-agent-panel.tsx`
- Client component, used in both onboarding and budgets page
- Props: `{ monthlyIncome: number; month: number; year: number; onDone?: () => void }`
- On mount: fires `POST /api/ai/suggest-budgets`, reads SSE stream
- Renders streaming thinking text → then editable budget rows → apply button
- Each row: category label, source badge (`actual` | `rule`), editable `<input type="number" />`
- Footer: live total budgeted + projected savings (recalculates on every input change)
- "Apply All" → sequential `POST /api/budgets` calls → success toast

### 4. `<OnboardingBanner />` — `src/components/budgets/onboarding-banner.tsx`
- Rendered at top of `/budgets` page when `budgets.length === 0` for current month
- Card with copy + "Set up with AI" button
- Button click sets local state `showAgent = true` → renders `<BudgetAgentPanel />` below banner
- Banner hides once agent panel is shown

### 5. Onboarding redirect — `src/app/(app)/layout.tsx`
- After auth, client component checks `localStorage.getItem('onboarding_complete')`
- If missing AND user has 0 transactions AND 0 accounts → redirect to `/onboarding`
- Prevents redirect loop for existing users who clear localStorage

---

## Gemini Prompt Design

```
You are a personal finance AI helping set up a monthly budget.

User's monthly income: ${{income}}
Last 3 months average spending by category:
{{category}}: ${{avg}} ({{n}} transactions)
...

Data confidence: {{high|low}}

Rules:
- Target minimum 20% savings (i.e. total budgets ≤ 80% of income)
- For categories with high confidence data: stay within 10% of the actual average
- For categories with low/no data: use 50/30/20 framework (needs/wants/savings)
- Housing is a "need", Food/Transport/Health are "needs", Entertainment/Shopping are "wants"

For each spending category (Food, Housing, Transport, Health, Entertainment, Shopping, Other):
1. Think through what limit makes sense (stream your reasoning)
2. Output a JSON proposal at the end

Output format — think first in plain text, then output:
<proposal>
[{ "category": "Food", "suggestedLimit": 520, "reasoning": "...", "source": "actual" }, ...]
</proposal>
```

Gemini streams the thinking text token by token. The server parses `<proposal>...</proposal>` when it appears and emits a `proposal` SSE event. Everything before the tag is emitted as `thinking` events.

---

## Roadmap (all 4 phases)

| Phase | Feature | Status |
|---|---|---|
| 1 | Budget Setup Agent | 🔨 In progress |
| 2 | Tool-Calling AI Chat | 📋 Planned |
| 3 | Proactive Smart Alerts | 📋 Planned |
| 4 | Financial Goals Agent | 📋 Planned |

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Gemini API unavailable | Emit `error` SSE event, show fallback "Set up manually" link |
| No transactions + no income | Step 1 income input is required — cannot skip |
| `< 10` transactions | Show "low data" notice, agent leans on income rules, still proposes |
| User applies partial budgets | Each `POST /api/budgets` is independent; partial success is fine |
| User already has budgets this month | `upsertBudget` overwrites — existing `OnboardingBanner` only shows when 0 budgets exist |

---

## Files Changed / Created

**New files:**
- `src/app/(app)/onboarding/page.tsx`
- `src/app/api/ai/suggest-budgets/route.ts`
- `src/components/onboarding/onboarding-wizard.tsx`
- `src/components/onboarding/budget-agent-panel.tsx`
- `src/components/onboarding/income-step.tsx`
- `src/components/onboarding/csv-step.tsx`
- `src/components/budgets/onboarding-banner.tsx`

**Modified files:**
- `src/app/(app)/layout.tsx` — add onboarding redirect logic
- `src/app/(app)/budgets/page.tsx` — render `<OnboardingBanner />`
- `src/lib/gemini.ts` — add `suggestBudgets()` streaming function
