# MoneyPlan — Agentic Features Roadmap

| Phase | Feature | Status |
|---|---|---|
| 1 | Budget Setup Agent | ✅ Complete |
| 1b | Plaid Bank Integration | ✅ Complete |
| 2 | Tool-Calling AI Chat | 📋 Planned |
| 3 | Proactive Smart Alerts | 📋 Planned |
| 4 | Financial Goals Agent | 📋 Planned |

## Phase 1: Budget Setup Agent
AI analyses 3 months of spending history, streams reasoning via SSE, proposes editable monthly budgets, applies them in one click. Accessible from new-user onboarding wizard and Budgets page banner.

## Phase 1b: Plaid Bank Integration
Connect real bank accounts via Plaid Link (sandbox + production). AES-256-CBC encrypted access tokens stored in DB. Manual "Sync Now" syncs balances and imports transactions with deduplication via plaidTransactionId. Connect Bank button lives in the Net Worth page header.

## Phase 2: Tool-Calling AI Chat
Extend the existing AI Chat with real tools the agent can call: `createTransaction`, `upsertBudget`, `createAccount`, `getSpendingReport`, `createGoal`. User says "Add $45 Uber Eats from yesterday" and it happens.

## Phase 3: Proactive Smart Alerts
Agent monitors spending after each transaction is added. When a budget hits 80% or is exceeded, surface an alert card on the Dashboard with one-click remediation options (increase budget, get tips, dismiss).

## Phase 4: Financial Goals Agent
User sets a goal (e.g. "Save $10k by December"). Agent creates a monthly savings plan, adjusts budgets to support it, tracks progress, and surfaces insights when the user is ahead or behind.
