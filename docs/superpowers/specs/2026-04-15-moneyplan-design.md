# MoneyPlan — Design Spec
**Date:** 2026-04-15
**Status:** Approved

## Overview

A personal finance web app for tracking all money — where it goes, how it's categorized, and AI-powered insights on net worth, budget health, and future financial planning. Built entirely on free-tier services for personal use.

---

## Tech Stack

| Layer | Tool | Free Tier |
|---|---|---|
| Framework | Next.js 14 (App Router) | Open source |
| Hosting | Vercel | Free tier |
| Database | Neon Postgres | 512MB free |
| Auth | NextAuth.js | Open source |
| Bank sync | CSV upload (primary) + Plaid (optional later) | Free |
| AI insights | Google Gemini API | Free tier (1500 req/day) |
| Styling | Tailwind CSS + shadcn/ui | Open source |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                 Next.js App                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │Dashboard │  │Transactions│ │ Net Worth │ │
│  └──────────┘  └──────────┘  └───────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ AI Chat  │  │ Budgets  │  │  Reports  │ │
│  └──────────┘  └──────────┘  └───────────┘ │
└────────────────────┬────────────────────────┘
                     │ API Routes
        ┌────────────┴────────────┐
        │                         │
   Neon Postgres            Gemini API
   (transactions,           (insights,
    accounts,               chat, forecast)
    net worth)
```

---

## Core Modules

### 1. Dashboard
- Spending summary (current month)
- Net worth snapshot (current + trend vs last month)
- Recent transactions list
- AI-generated tip of the day
- Budget health score (A/B/C/D rating)

### 2. Transactions
- CSV upload with auto column detection (handles different bank formats)
- Duplicate detection — skips already-imported transactions
- Gemini auto-categorization on import
- Manual add/edit/delete
- Search, filter by category/date/account

### 3. Net Worth
- Track all asset types:
  - Bank accounts (checking, savings)
  - Investments (stocks, mutual funds)
  - Crypto
  - Real estate
  - Retirement accounts
  - Vehicles
- Track all liabilities: loans, credit card debt
- Monthly snapshot automatically saved for historical charting

### 4. Budgets
- Set monthly spending limits per category
- Visual progress bars per category
- Alerts when approaching or exceeding limit
- Month-over-month budget performance

### 5. AI Chat
Natural language interface powered by Gemini. Sends aggregated financial summaries as context. Example queries:
- "How much did I spend on food last month?"
- "What's my biggest expense category this year?"
- "Am I saving enough to hit $50k by December?"
- "Where can I cut back to save an extra $500/month?"

### 6. Reports & Forecast
- 6–12 month net worth projection based on current income vs spending rate
- Spending trends (month-over-month category comparisons)
- "If you reduce X by $Y, you'll reach goal Z months sooner" insights
- Export-friendly views

---

## Data Model

```sql
-- Users (managed by NextAuth)
users (
  id, email, name, image, created_at
)

-- Financial accounts / asset types
accounts (
  id, user_id, name,
  type: checking | savings | credit | investment |
        crypto | real_estate | loan | retirement | vehicle,
  balance, currency, last_updated
)

-- All transactions
transactions (
  id, account_id, user_id,
  amount, date, description,
  category: Food | Housing | Transport | Health |
             Entertainment | Shopping | Income | Other,
  source: csv_upload | plaid | manual,
  created_at
)

-- Monthly budget limits
budgets (
  id, user_id, category,
  monthly_limit, month, year, created_at
)

-- Monthly net worth history for charting
net_worth_snapshots (
  id, user_id,
  total_assets, total_liabilities, net_worth,
  snapshot_date
)
```

**Key decisions:**
- Categories are an enum — Gemini suggests, user can override
- `net_worth_snapshots` taken automatically once/month for historical tracking
- `source` field tracks transaction origin (CSV, Plaid, manual)

---

## Authentication

- **NextAuth.js** with two providers:
  - Google OAuth (one-click login)
  - Email + password fallback
- Sessions stored in Neon Postgres
- All data strictly scoped to the logged-in user

---

## Data Ingestion

### CSV Upload (Primary)
1. User downloads statement from bank (all banks support CSV)
2. Uploads file in MoneyPlan
3. App auto-detects columns (date, amount, description)
4. Gemini categorizes each transaction
5. Duplicate detection skips already-imported rows

### Plaid (Optional / Future)
- Works free in sandbox/dev mode
- Designed as a config flag — no code changes needed to enable
- Drop-in addition, does not replace CSV flow

### Manual Entry
- Add transactions by hand
- Used for net worth assets that can't be bank-synced (real estate, vehicles, crypto manual entries)

---

## AI Features (Gemini API)

### 1. Auto-Categorization
Gemini reads transaction descriptions and assigns categories on import. User overrides are respected going forward.

### 2. AI Chat
Gemini receives aggregated financial summaries as context (not raw transaction descriptions with personal merchant names). Answers natural language questions about spending, savings, and goals.

### 3. Dashboard Insights & Forecasting
- Spending trend alerts ("You spent 30% more on dining this month")
- Net worth projection for next 6–12 months
- Budget health score
- Actionable savings recommendations

**Privacy:** Only aggregated summaries (totals per category, monthly snapshots) sent to Gemini by default. Raw descriptions only sent if user explicitly asks about them in chat.

---

## Out of Scope (for now)
- Mobile app
- Multi-user / family accounts
- Tax reporting / export
- Receipt scanning
- Recurring bill detection
