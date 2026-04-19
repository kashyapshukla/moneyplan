# Money Tracking Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five interconnected features — Recurring/Subscription Tracker, Upcoming Bill Calendar, Financial Goals, Unusual Spending Alerts, and Debt Payoff Tracker — to give users complete visibility into where their money goes and where it's headed.

**Architecture:** Two new DB tables (`recurring_transactions`, `goals`) power all five features. A detection engine in `src/lib/recurring.ts` mines existing transactions to auto-populate recurring items. Goals, calendar projections, and alerts are all derived from those two tables plus the existing `transactions` and `accounts` tables.

**Tech Stack:** Next.js 14 App Router, Drizzle ORM + Neon Postgres, Tailwind CSS, Recharts, Lucide icons. No new npm dependencies required.

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `scripts/add-recurring-goals-tables.ts` | DB migration: create recurring_transactions + goals tables |
| `src/lib/recurring.ts` | Detection algorithm + CRUD queries for recurring items |
| `src/lib/goals.ts` | Goal CRUD + debt payoff math + emergency fund calc |
| `src/lib/alerts.ts` | Anomaly detection: compare current month vs 3-month rolling avg |
| `src/app/api/recurring/route.ts` | GET list / PATCH update (toggle subscription flag) |
| `src/app/api/recurring/detect/route.ts` | POST: run detection for current user, upsert results |
| `src/app/api/goals/route.ts` | GET list / POST create / PATCH update / DELETE |
| `src/app/(app)/recurring/page.tsx` | Server component: subscriptions + recurring bills page |
| `src/app/(app)/calendar/page.tsx` | Server component: upcoming bill calendar page |
| `src/app/(app)/goals/page.tsx` | Server component: goals + debt payoff page |
| `src/components/recurring/recurring-list.tsx` | Client: list with toggle subscription, annual cost, monthly total |
| `src/components/recurring/detect-button.tsx` | Client: "Detect Recurring" button with loading state |
| `src/components/calendar/bill-calendar.tsx` | Client: month grid with projected income/bill dots + daily balance |
| `src/components/goals/goals-list.tsx` | Client: goal cards with progress bars |
| `src/components/goals/goal-form-dialog.tsx` | Client: create/edit goal dialog |
| `src/components/goals/debt-payoff-card.tsx` | Client: amortization calculator with slider |
| `src/components/goals/emergency-fund-card.tsx` | Client: months-of-expenses coverage gauge |
| `src/components/dashboard/spending-alerts.tsx` | Client: dismissable alert cards for overspending |

### Modified files
| File | Change |
|---|---|
| `src/lib/schema.ts` | Add `recurringTransactions` + `goals` table definitions |
| `src/app/(app)/budgets/page.tsx` | Import + render `<SpendingAlerts>` above budget list |
| `src/components/layout/sidebar.tsx` (or nav file) | Add Recurring, Calendar, Goals nav links |

---

## Task 1: DB Schema + Migration

**Files:**
- Modify: `src/lib/schema.ts`
- Create: `scripts/add-recurring-goals-tables.ts`

- [ ] **Step 1: Add tables to schema.ts**

Add after the `incomeSources` table at the bottom of `src/lib/schema.ts`:

```ts
export const recurringTransactions = pgTable("recurring_transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  description: text("description").notNull(),       // normalized description pattern
  displayName: text("display_name").notNull(),       // human-readable name (editable)
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  category: categoryEnum("category").notNull().default("Other"),
  frequency: text("frequency").notNull(),            // 'weekly' | 'monthly' | 'annual'
  dayOfMonth: integer("day_of_month"),               // typical day (1-31) for monthly
  lastSeen: date("last_seen", { mode: "date" }).notNull(),
  nextExpected: date("next_expected", { mode: "date" }),
  isSubscription: text("is_subscription").notNull().default("false"), // user-confirmed
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [uniqueIndex("recurring_user_desc_idx").on(t.userId, t.description)]);

export const goalsTypeEnum = pgEnum("goal_type", [
  "savings",      // save $X by date Y
  "debt_payoff",  // pay off account by date Y
  "emergency_fund", // build N months of expenses
]);

export const goals = pgTable("goals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: goalsTypeEnum("type").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }),
  currentAmount: numeric("current_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  monthlyContribution: numeric("monthly_contribution", { precision: 12, scale: 2 }),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).default("0"), // APR %
  targetDate: date("target_date", { mode: "date" }),
  linkedAccountId: text("linked_account_id").references(() => accounts.id, { onDelete: "set null" }),
  targetMonths: integer("target_months"),            // for emergency_fund: desired months coverage
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
```

Also add `goalsTypeEnum` export to top-level imports in schema.ts (add `pgEnum` is already imported).

- [ ] **Step 2: Create migration script**

Create `scripts/add-recurring-goals-tables.ts`:

```ts
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // recurring_transactions
  await sql`
    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      display_name TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      frequency TEXT NOT NULL,
      day_of_month INTEGER,
      last_seen DATE NOT NULL,
      next_expected DATE,
      is_subscription TEXT NOT NULL DEFAULT 'false',
      is_active TEXT NOT NULL DEFAULT 'true',
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      UNIQUE(user_id, description)
    )
  `;
  console.log("recurring_transactions created");

  // goal_type enum
  await sql`DO $$ BEGIN
    CREATE TYPE goal_type AS ENUM ('savings','debt_payoff','emergency_fund');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;

  // goals
  await sql`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type goal_type NOT NULL,
      target_amount NUMERIC(12,2),
      current_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      monthly_contribution NUMERIC(12,2),
      interest_rate NUMERIC(5,2) DEFAULT 0,
      target_date DATE,
      linked_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      target_months INTEGER,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `;
  console.log("goals created");
}

main().catch(console.error);
```

- [ ] **Step 3: Run migration**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
npx tsx scripts/add-recurring-goals-tables.ts
```

Expected output:
```
recurring_transactions created
goals created
```

- [ ] **Step 4: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema.ts scripts/add-recurring-goals-tables.ts
git commit -m "feat: add recurring_transactions and goals DB tables"
```

---

## Task 2: Recurring Detection Engine

**Files:**
- Create: `src/lib/recurring.ts`
- Create: `src/app/api/recurring/detect/route.ts`
- Create: `src/app/api/recurring/route.ts`

- [ ] **Step 1: Create `src/lib/recurring.ts`**

```ts
import { db } from "./db";
import { transactions, recurringTransactions } from "./schema";
import { eq, and, gte, ne, sql } from "drizzle-orm";

export type RecurringItem = {
  id: string;
  description: string;
  displayName: string;
  amount: number;
  category: string;
  frequency: "weekly" | "monthly" | "annual";
  dayOfMonth: number | null;
  lastSeen: Date;
  nextExpected: Date | null;
  isSubscription: boolean;
  isActive: boolean;
};

// Normalize description for grouping: lowercase, strip non-alphanumeric except spaces
function normalizeDesc(desc: string): string {
  return desc.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

// Compute median of a number array
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Classify interval in days → frequency label
function classifyInterval(medianDays: number): "weekly" | "monthly" | "annual" | null {
  if (medianDays >= 6 && medianDays <= 9) return "weekly";
  if (medianDays >= 25 && medianDays <= 35) return "monthly";
  if (medianDays >= 340 && medianDays <= 390) return "annual";
  return null;
}

// Project next expected date from lastSeen + frequency
function nextExpectedDate(lastSeen: Date, frequency: "weekly" | "monthly" | "annual"): Date {
  const d = new Date(lastSeen);
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

export async function detectRecurring(userId: string): Promise<number> {
  // Fetch last 13 months of negative (expense) transactions, excluding Transfer
  const since = new Date();
  since.setMonth(since.getMonth() - 13);

  const rows = await db
    .select({
      description: transactions.description,
      amount: transactions.amount,
      date: transactions.date,
      category: transactions.category,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, since),
        sql`${transactions.amount}::numeric < 0`,
        ne(transactions.category, "Transfer")
      )
    );

  // Group by normalized description
  const groups = new Map<string, { desc: string; amounts: number[]; dates: Date[]; category: string }>();
  for (const row of rows) {
    const key = normalizeDesc(row.description);
    if (!groups.has(key)) {
      groups.set(key, { desc: row.description, amounts: [], dates: [], category: row.category });
    }
    const g = groups.get(key)!;
    g.amounts.push(Math.abs(parseFloat(row.amount)));
    g.dates.push(new Date(row.date));
  }

  let detected = 0;

  for (const [key, g] of Array.from(groups.entries())) {
    if (g.dates.length < 2) continue;

    // Sort dates ascending, compute intervals
    g.dates.sort((a, b) => a.getTime() - b.getTime());
    const intervals: number[] = [];
    for (let i = 1; i < g.dates.length; i++) {
      const diffMs = g.dates[i].getTime() - g.dates[i - 1].getTime();
      intervals.push(diffMs / (1000 * 60 * 60 * 24));
    }

    const medianInterval = median(intervals);
    const frequency = classifyInterval(medianInterval);
    if (!frequency) continue;

    // Amount consistency: coefficient of variation < 20%
    const avgAmt = g.amounts.reduce((s, v) => s + v, 0) / g.amounts.length;
    const stddev = Math.sqrt(g.amounts.reduce((s, v) => s + (v - avgAmt) ** 2, 0) / g.amounts.length);
    if (avgAmt > 0 && stddev / avgAmt > 0.2) continue;

    const lastSeen = g.dates[g.dates.length - 1];
    const dayOfMonth = frequency === "monthly" ? lastSeen.getDate() : null;
    const nextExpected = nextExpectedDate(lastSeen, frequency);

    // Upsert into recurring_transactions
    await db
      .insert(recurringTransactions)
      .values({
        id: crypto.randomUUID(),
        userId,
        description: key,
        displayName: g.desc,
        amount: String(avgAmt.toFixed(2)),
        category: g.category as never,
        frequency,
        dayOfMonth,
        lastSeen,
        nextExpected,
        isSubscription: "false",
        isActive: "true",
      })
      .onConflictDoUpdate({
        target: [recurringTransactions.userId, recurringTransactions.description],
        set: {
          amount: String(avgAmt.toFixed(2)),
          lastSeen,
          nextExpected,
          dayOfMonth,
          frequency,
        },
      });

    detected++;
  }

  return detected;
}

export async function listRecurring(userId: string): Promise<RecurringItem[]> {
  const rows = await db
    .select()
    .from(recurringTransactions)
    .where(and(eq(recurringTransactions.userId, userId), eq(recurringTransactions.isActive, "true")))
    .orderBy(recurringTransactions.amount);

  return rows.map((r) => ({
    id: r.id,
    description: r.description,
    displayName: r.displayName,
    amount: parseFloat(r.amount),
    category: r.category,
    frequency: r.frequency as "weekly" | "monthly" | "annual",
    dayOfMonth: r.dayOfMonth,
    lastSeen: new Date(r.lastSeen),
    nextExpected: r.nextExpected ? new Date(r.nextExpected) : null,
    isSubscription: r.isSubscription === "true",
    isActive: r.isActive === "true",
  }));
}

export async function updateRecurring(
  id: string,
  userId: string,
  data: Partial<{ isSubscription: boolean; isActive: boolean; displayName: string }>
) {
  await db
    .update(recurringTransactions)
    .set({
      ...(data.isSubscription !== undefined && { isSubscription: data.isSubscription ? "true" : "false" }),
      ...(data.isActive !== undefined && { isActive: data.isActive ? "true" : "false" }),
      ...(data.displayName !== undefined && { displayName: data.displayName }),
    })
    .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId)));
}
```

- [ ] **Step 2: Create API routes**

Create `src/app/api/recurring/detect/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { detectRecurring } from "@/lib/recurring";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const count = await detectRecurring(session.user.id);
  return NextResponse.json({ detected: count });
}
```

Create `src/app/api/recurring/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listRecurring, updateRecurring } from "@/lib/recurring";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listRecurring(session.user.id);
  return NextResponse.json(items);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, ...data } = await req.json();
  await updateRecurring(id, session.user.id, data);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/lib/recurring.ts src/app/api/recurring/
git commit -m "feat: recurring detection engine and API routes"
```

---

## Task 3: Recurring / Subscription Tracker UI

**Files:**
- Create: `src/components/recurring/detect-button.tsx`
- Create: `src/components/recurring/recurring-list.tsx`
- Create: `src/app/(app)/recurring/page.tsx`

- [ ] **Step 1: Create `src/components/recurring/detect-button.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function DetectButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/recurring/detect", { method: "POST" });
      const { detected } = await res.json();
      setResult(`Found ${detected} recurring pattern${detected !== 1 ? "s" : ""}`);
      router.refresh();
    } catch {
      setResult("Detection failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={run} disabled={loading} variant="outline" size="sm" className="gap-1.5">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {loading ? "Detecting…" : "Detect Recurring"}
      </Button>
      {result && <span className="text-xs text-slate-500">{result}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/recurring/recurring-list.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Tag, X } from "lucide-react";

type RecurringItem = {
  id: string;
  displayName: string;
  amount: number;
  category: string;
  frequency: "weekly" | "monthly" | "annual";
  dayOfMonth: number | null;
  nextExpected: string | null;
  isSubscription: boolean;
};

const FREQ_LABEL: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  annual: "Annual",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function toMonthly(amount: number, freq: string): number {
  if (freq === "weekly") return amount * 52 / 12;
  if (freq === "annual") return amount / 12;
  return amount;
}

export function RecurringList({ initialItems }: { initialItems: RecurringItem[] }) {
  const [items, setItems] = useState(initialItems);

  async function toggle(id: string, field: "isSubscription" | "isActive", value: boolean) {
    await fetch("/api/recurring", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [field]: value }),
    });
    setItems((prev) =>
      field === "isActive"
        ? prev.filter((i) => i.id !== id)
        : prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  }

  const subscriptions = items.filter((i) => i.isSubscription);
  const bills = items.filter((i) => !i.isSubscription);

  const monthlySubscriptionTotal = subscriptions.reduce(
    (s, i) => s + toMonthly(i.amount, i.frequency), 0
  );
  const monthlyBillTotal = bills.reduce(
    (s, i) => s + toMonthly(i.amount, i.frequency), 0
  );

  function ItemRow({ item }: { item: RecurringItem }) {
    return (
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{item.displayName}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {FREQ_LABEL[item.frequency]}
            {item.dayOfMonth && item.frequency === "monthly" ? ` · ~day ${item.dayOfMonth}` : ""}
            {item.nextExpected
              ? ` · next ${new Date(item.nextExpected).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : ""}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold tabular-nums text-slate-900">{fmt(item.amount)}</p>
          <p className="text-xs text-slate-400">{fmt(toMonthly(item.amount, item.frequency))}/mo</p>
        </div>
        <div className="flex items-center gap-1">
          {!item.isSubscription && (
            <button
              onClick={() => toggle(item.id, "isSubscription", true)}
              className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors font-medium"
              title="Mark as subscription"
            >
              <Tag className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={() => toggle(item.id, "isActive", false)}
            className="text-xs px-1.5 py-1 rounded-full text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-slate-400 text-sm">No recurring transactions detected yet.</p>
        <p className="text-slate-400 text-xs mt-1">Click "Detect Recurring" to scan your transactions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Subscriptions */}
      {subscriptions.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Subscriptions</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {subscriptions.length} active · {fmt(monthlySubscriptionTotal)}/mo · {fmt(monthlySubscriptionTotal * 12)}/yr
              </p>
            </div>
          </div>
          {subscriptions.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Recurring Bills */}
      {bills.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Recurring Bills</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {bills.length} detected · {fmt(monthlyBillTotal)}/mo committed
              </p>
            </div>
            <p className="text-xs text-slate-400">Click <Tag className="inline h-3 w-3" /> to mark as subscription</p>
          </div>
          {bills.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/(app)/recurring/page.tsx`**

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listRecurring } from "@/lib/recurring";
import { RecurringList } from "@/components/recurring/recurring-list";
import { DetectButton } from "@/components/recurring/detect-button";

export default async function RecurringPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const items = await listRecurring(session.user.id);

  const monthlyCommitted = items.reduce((s, i) => {
    const monthly = i.frequency === "weekly" ? i.amount * 52 / 12
      : i.frequency === "annual" ? i.amount / 12
      : i.amount;
    return s + monthly;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recurring & Subscriptions</h1>
          <p className="text-sm text-slate-500 mt-1">
            {items.length} detected ·{" "}
            <span className="font-semibold text-slate-700">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(monthlyCommitted)}/mo
            </span>{" "}
            committed spend ·{" "}
            <span className="font-semibold text-slate-700">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(monthlyCommitted * 12)}/yr
            </span>
          </p>
        </div>
        <DetectButton />
      </div>

      <RecurringList initialItems={items.map(i => ({
        ...i,
        nextExpected: i.nextExpected?.toISOString() ?? null,
        lastSeen: undefined as never,
      }))} />
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/components/recurring/ src/app/(app)/recurring/
git commit -m "feat: recurring/subscription tracker UI"
```

---

## Task 4: Upcoming Bill Calendar

**Files:**
- Create: `src/lib/calendar.ts`
- Create: `src/components/calendar/bill-calendar.tsx`
- Create: `src/app/(app)/calendar/page.tsx`

- [ ] **Step 1: Create `src/lib/calendar.ts`**

```ts
import { listRecurring, RecurringItem } from "./recurring";
import { getIncomeSourceDescriptions } from "./reports";
import { db } from "./db";
import { transactions } from "./schema";
import { eq, and, gte, lte, inArray, sql } from "drizzle-orm";

export type CalendarDay = {
  date: string;          // "YYYY-MM-DD"
  bills: { name: string; amount: number; category: string }[];
  income: { name: string; amount: number }[];
  projectedBalance: number | null; // rolling projected cash balance
};

function dateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Project all occurrences of a recurring item within [from, to]
function projectOccurrences(
  item: RecurringItem,
  from: Date,
  to: Date
): Date[] {
  const dates: Date[] = [];
  if (!item.nextExpected) return dates;

  let current = new Date(item.nextExpected);
  // Step backwards to find all occurrences in range
  while (current <= to) {
    if (current >= from) dates.push(new Date(current));
    if (item.frequency === "weekly") current = addDays(current, 7);
    else if (item.frequency === "monthly") {
      current = new Date(current);
      current.setMonth(current.getMonth() + 1);
    } else {
      current = new Date(current);
      current.setFullYear(current.getFullYear() + 1);
    }
  }
  return dates;
}

export async function getCalendarData(
  userId: string,
  from: Date,
  to: Date
): Promise<CalendarDay[]> {
  const [recurring, incomeDescriptions] = await Promise.all([
    listRecurring(userId),
    getIncomeSourceDescriptions(userId),
  ]);

  // Get recent income transactions to compute avg income occurrence
  let incomeRows: { description: string; amount: string; date: Date }[] = [];
  if (incomeDescriptions.length > 0) {
    const since = addDays(from, -60);
    incomeRows = await db
      .select({ description: transactions.description, amount: transactions.amount, date: transactions.date })
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        gte(transactions.date, since),
        lte(transactions.date, to),
        sql`${transactions.amount}::numeric > 0`,
        inArray(transactions.description, incomeDescriptions)
      ));
  }

  // Build day map
  const dayMap = new Map<string, CalendarDay>();
  let current = new Date(from);
  while (current <= to) {
    const key = dateStr(current);
    dayMap.set(key, { date: key, bills: [], income: [], projectedBalance: null });
    current = addDays(current, 1);
  }

  // Place recurring bills
  for (const item of recurring) {
    for (const occ of projectOccurrences(item, from, to)) {
      const key = dateStr(occ);
      if (dayMap.has(key)) {
        dayMap.get(key)!.bills.push({
          name: item.displayName,
          amount: item.amount,
          category: item.category,
        });
      }
    }
  }

  // Place past income as reference (actual transactions in range)
  for (const row of incomeRows) {
    const key = dateStr(new Date(row.date));
    if (dayMap.has(key)) {
      dayMap.get(key)!.income.push({
        name: row.description,
        amount: parseFloat(row.amount),
      });
    }
  }

  return Array.from(dayMap.values());
}
```

- [ ] **Step 2: Create `src/components/calendar/bill-calendar.tsx`**

```tsx
"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type CalendarDay = {
  date: string;
  bills: { name: string; amount: number; category: string }[];
  income: { name: string; amount: number }[];
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function BillCalendar({ days }: { days: CalendarDay[] }) {
  const [tooltip, setTooltip] = useState<CalendarDay | null>(null);

  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm">
        No recurring items detected yet. Go to Recurring &amp; Subscriptions and click "Detect Recurring".
      </div>
    );
  }

  // Group by month
  const months = new Map<string, CalendarDay[]>();
  for (const day of days) {
    const key = day.date.slice(0, 7); // "YYYY-MM"
    if (!months.has(key)) months.set(key, []);
    months.get(key)!.push(day);
  }

  return (
    <div className="space-y-6">
      {Array.from(months.entries()).map(([monthKey, monthDays]) => {
        const [year, month] = monthKey.split("-").map(Number);
        const monthName = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
          month: "long", year: "numeric",
        });
        const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
        const totalBills = monthDays.reduce((s, d) => s + d.bills.reduce((b, i) => b + i.amount, 0), 0);
        const totalIncome = monthDays.reduce((s, d) => s + d.income.reduce((b, i) => b + i.amount, 0), 0);

        return (
          <div key={monthKey} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">{monthName}</h3>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                {totalIncome > 0 && <span className="text-emerald-600 font-semibold">+{fmt(totalIncome)} income</span>}
                {totalBills > 0 && <span className="text-red-500 font-semibold">−{fmt(totalBills)} bills</span>}
              </div>
            </div>

            <div className="p-4">
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Leading empty cells */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {monthDays.map((day) => {
                  const d = new Date(day.date + "T12:00:00");
                  const hasBills = day.bills.length > 0;
                  const hasIncome = day.income.length > 0;
                  const isToday = day.date === new Date().toISOString().split("T")[0];

                  return (
                    <div
                      key={day.date}
                      onClick={() => setTooltip(tooltip?.date === day.date ? null : day)}
                      className={`relative rounded-lg p-1.5 min-h-[52px] cursor-pointer transition-colors ${
                        isToday ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-slate-50"
                      }`}
                    >
                      <span className={`text-xs font-medium block text-center mb-1 ${
                        isToday ? "text-indigo-700" : "text-slate-600"
                      }`}>
                        {d.getDate()}
                      </span>
                      <div className="flex flex-wrap gap-0.5 justify-center">
                        {hasIncome && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="Income" />
                        )}
                        {day.bills.slice(0, 3).map((b, i) => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                        ))}
                        {day.bills.length > 3 && (
                          <span className="text-[9px] text-slate-400">+{day.bills.length - 3}</span>
                        )}
                      </div>
                      {(hasBills || hasIncome) && (
                        <p className="text-[9px] text-center text-slate-500 mt-0.5 tabular-nums">
                          {hasBills ? `−${fmt(day.bills.reduce((s, b) => s + b.amount, 0))}` : ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tooltip detail */}
            {tooltip && tooltip.date.startsWith(monthKey) && (
              <div className="mx-4 mb-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  {new Date(tooltip.date + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "long", month: "long", day: "numeric",
                  })}
                </p>
                {tooltip.income.map((i, idx) => (
                  <div key={idx} className="flex justify-between text-xs mb-1">
                    <span className="text-emerald-700">↑ {i.name}</span>
                    <span className="font-semibold text-emerald-700">{fmt(i.amount)}</span>
                  </div>
                ))}
                {tooltip.bills.map((b, idx) => (
                  <div key={idx} className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">↓ {b.name}</span>
                    <span className="font-semibold text-red-600">−{fmt(b.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/(app)/calendar/page.tsx`**

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCalendarData } from "@/lib/calendar";
import { BillCalendar } from "@/components/calendar/bill-calendar";

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 2, 0); // end of next month

  const days = await getCalendarData(session.user.id, from, to);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upcoming Bills</h1>
        <p className="text-sm text-slate-500 mt-1">
          Projected recurring bills and income for the next 2 months
        </p>
      </div>
      <BillCalendar days={days.map(d => ({ ...d }))} />
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar.ts src/components/calendar/ src/app/(app)/calendar/
git commit -m "feat: upcoming bill calendar with projected recurring items"
```

---

## Task 5: Financial Goals System

**Files:**
- Create: `src/lib/goals.ts`
- Create: `src/app/api/goals/route.ts`
- Create: `src/components/goals/goal-form-dialog.tsx`
- Create: `src/components/goals/goals-list.tsx`
- Create: `src/app/(app)/goals/page.tsx`

- [ ] **Step 1: Create `src/lib/goals.ts`**

```ts
import { db } from "./db";
import { goals, accounts, transactions } from "./schema";
import { eq, and, sql } from "drizzle-orm";

export type Goal = {
  id: string;
  name: string;
  type: "savings" | "debt_payoff" | "emergency_fund";
  targetAmount: number | null;
  currentAmount: number;
  monthlyContribution: number | null;
  interestRate: number;
  targetDate: Date | null;
  linkedAccountId: string | null;
  linkedAccountBalance: number | null;
  linkedAccountName: string | null;
  targetMonths: number | null;
  progressPct: number;
  projectedCompletionDate: Date | null;
};

// How many months to pay off a balance given monthly payment and APR
function payoffMonths(balance: number, payment: number, apr: number): number {
  if (balance <= 0) return 0;
  if (apr === 0) return Math.ceil(balance / payment);
  const r = apr / 100 / 12;
  if (payment <= balance * r) return Infinity; // payment doesn't cover interest
  return Math.ceil(-Math.log(1 - (balance * r) / payment) / Math.log(1 + r));
}

// Project completion date from today + N months
function addMonths(n: number): Date | null {
  if (!isFinite(n)) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d;
}

export async function listGoals(userId: string): Promise<Goal[]> {
  const rows = await db
    .select({
      goal: goals,
      accountBalance: accounts.balance,
      accountName: accounts.name,
    })
    .from(goals)
    .leftJoin(accounts, eq(goals.linkedAccountId, accounts.id))
    .where(eq(goals.userId, userId))
    .orderBy(goals.createdAt);

  return rows.map(({ goal: g, accountBalance, accountName }) => {
    const linkedBal = accountBalance ? parseFloat(accountBalance) : null;
    const targetAmt = g.targetAmount ? parseFloat(g.targetAmount) : null;
    const currentAmt = linkedBal !== null ? Math.abs(linkedBal) : parseFloat(g.currentAmount);
    const contribution = g.monthlyContribution ? parseFloat(g.monthlyContribution) : null;
    const rate = parseFloat(g.interestRate ?? "0");

    let progressPct = 0;
    let projectedDate: Date | null = null;

    if (g.type === "savings" && targetAmt) {
      progressPct = Math.min(100, (currentAmt / targetAmt) * 100);
      if (contribution && contribution > 0) {
        const monthsLeft = Math.ceil((targetAmt - currentAmt) / contribution);
        projectedDate = addMonths(monthsLeft);
      }
    } else if (g.type === "debt_payoff" && targetAmt && contribution) {
      const paid = targetAmt - currentAmt; // currentAmt = remaining balance
      progressPct = Math.min(100, (paid / targetAmt) * 100);
      projectedDate = addMonths(payoffMonths(currentAmt, contribution, rate));
    } else if (g.type === "emergency_fund") {
      progressPct = Math.min(100, targetAmt ? (currentAmt / targetAmt) * 100 : 0);
    }

    return {
      id: g.id,
      name: g.name,
      type: g.type,
      targetAmount: targetAmt,
      currentAmount: currentAmt,
      monthlyContribution: contribution,
      interestRate: rate,
      targetDate: g.targetDate ? new Date(g.targetDate) : null,
      linkedAccountId: g.linkedAccountId,
      linkedAccountBalance: linkedBal,
      linkedAccountName: accountName ?? null,
      targetMonths: g.targetMonths,
      progressPct,
      projectedCompletionDate: projectedDate,
    };
  });
}

export async function createGoal(
  userId: string,
  data: {
    name: string;
    type: "savings" | "debt_payoff" | "emergency_fund";
    targetAmount?: number;
    monthlyContribution?: number;
    interestRate?: number;
    targetDate?: string;
    linkedAccountId?: string;
    targetMonths?: number;
  }
) {
  const [row] = await db
    .insert(goals)
    .values({
      id: crypto.randomUUID(),
      userId,
      name: data.name,
      type: data.type,
      targetAmount: data.targetAmount ? String(data.targetAmount) : null,
      monthlyContribution: data.monthlyContribution ? String(data.monthlyContribution) : null,
      interestRate: data.interestRate ? String(data.interestRate) : "0",
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
      linkedAccountId: data.linkedAccountId ?? null,
      targetMonths: data.targetMonths ?? null,
    })
    .returning();
  return row;
}

export async function deleteGoal(id: string, userId: string) {
  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
}

// For emergency fund: compute average monthly spending from last 3 months
export async function getMonthlySpendingAvg(userId: string): Promise<number> {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(ABS(${transactions.amount}::numeric)), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        sql`${transactions.amount}::numeric < 0`,
        sql`${transactions.date} >= ${threeMonthsAgo.toISOString().split("T")[0]}`
      )
    );

  return parseFloat(row?.total ?? "0") / 3;
}
```

- [ ] **Step 2: Create `src/app/api/goals/route.ts`**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listGoals, createGoal, deleteGoal } from "@/lib/goals";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listGoals(session.user.id);
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await req.json();
  const goal = await createGoal(session.user.id, data);
  return NextResponse.json(goal);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  await deleteGoal(id, session.user.id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create `src/components/goals/goal-form-dialog.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Account = { id: string; name: string; type: string; balance: string };

export function GoalFormDialog({
  open,
  onOpenChange,
  onSaved,
  accounts,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  accounts: Account[];
}) {
  const [type, setType] = useState<"savings" | "debt_payoff" | "emergency_fund">("savings");
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [linkedAccountId, setLinkedAccountId] = useState("");
  const [targetMonths, setTargetMonths] = useState("6");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          targetAmount: targetAmount ? parseFloat(targetAmount) : undefined,
          monthlyContribution: monthlyContribution ? parseFloat(monthlyContribution) : undefined,
          interestRate: interestRate ? parseFloat(interestRate) : undefined,
          targetDate: targetDate || undefined,
          linkedAccountId: linkedAccountId || undefined,
          targetMonths: type === "emergency_fund" ? parseInt(targetMonths) : undefined,
        }),
      });
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const savingsAccounts = accounts.filter((a) => ["savings", "checking", "investment", "retirement"].includes(a.type));
  const debtAccounts = accounts.filter((a) => ["credit", "loan"].includes(a.type));
  const linkedOptions = type === "debt_payoff" ? debtAccounts : savingsAccounts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Financial Goal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Goal type */}
          <div className="grid grid-cols-3 gap-2">
            {(["savings", "debt_payoff", "emergency_fund"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  type === t ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t === "savings" ? "💰 Save" : t === "debt_payoff" ? "💳 Pay Off Debt" : "🛡 Emergency Fund"}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Goal Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === "savings" ? "Vacation fund" : type === "debt_payoff" ? "Pay off Visa" : "Emergency fund"}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>

          {type === "emergency_fund" && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Target Months of Expenses</label>
              <input
                type="number" min="1" max="24"
                value={targetMonths}
                onChange={(e) => setTargetMonths(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          )}

          {type !== "emergency_fund" && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                {type === "debt_payoff" ? "Current Balance Owed" : "Target Amount"}
              </label>
              <input
                type="number" step="0.01" required
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="10000"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          )}

          {linkedOptions.length > 0 && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Linked Account <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <select
                value={linkedAccountId}
                onChange={(e) => setLinkedAccountId(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              >
                <option value="">— select account —</option>
                {linkedOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.abs(parseFloat(a.balance)))})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Monthly Contribution</label>
            <input
              type="number" step="0.01"
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(e.target.value)}
              placeholder="500"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>

          {type === "debt_payoff" && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Interest Rate (APR %)</label>
              <input
                type="number" step="0.01"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="24.99"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          )}

          {type === "savings" && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Target Date</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          )}

          <div className="flex gap-2 pt-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create Goal"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Create `src/components/goals/goals-list.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Trash2, Plus, Target, Shield, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoalFormDialog } from "./goal-form-dialog";
import { useRouter } from "next/navigation";

type Goal = {
  id: string;
  name: string;
  type: "savings" | "debt_payoff" | "emergency_fund";
  targetAmount: number | null;
  currentAmount: number;
  monthlyContribution: number | null;
  interestRate: number;
  targetDate: string | null;
  projectedCompletionDate: string | null;
  progressPct: number;
  linkedAccountName: string | null;
  targetMonths: number | null;
};

type Account = { id: string; name: string; type: string; balance: string };

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Debt payoff amortization: total interest if paying monthlyPayment at APR
function totalInterest(balance: number, payment: number, apr: number): number {
  if (apr === 0 || payment <= 0) return 0;
  const r = apr / 100 / 12;
  if (payment <= balance * r) return Infinity;
  const months = Math.ceil(-Math.log(1 - (balance * r) / payment) / Math.log(1 + r));
  return Math.max(0, payment * months - balance);
}

const GOAL_ICONS = {
  savings: <Target className="h-5 w-5 text-indigo-600" />,
  debt_payoff: <CreditCard className="h-5 w-5 text-red-500" />,
  emergency_fund: <Shield className="h-5 w-5 text-teal-600" />,
};

const GOAL_COLORS = {
  savings: "bg-indigo-600",
  debt_payoff: "bg-red-500",
  emergency_fund: "bg-teal-600",
};

export function GoalsList({
  initialGoals,
  accounts,
}: {
  initialGoals: Goal[];
  accounts: Account[];
}) {
  const [goals, setGoals] = useState(initialGoals);
  const [addOpen, setAddOpen] = useState(false);
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("Delete this goal?")) return;
    await fetch("/api/goals", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  if (goals.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-slate-400 text-sm mb-3">No goals yet. Create your first financial goal.</p>
        <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Goal
        </Button>
        <GoalFormDialog open={addOpen} onOpenChange={setAddOpen} onSaved={() => router.refresh()} accounts={accounts} />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((g) => {
          const interest = g.type === "debt_payoff" && g.monthlyContribution && g.targetAmount
            ? totalInterest(g.currentAmount, g.monthlyContribution, g.interestRate)
            : null;

          return (
            <div key={g.id} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {GOAL_ICONS[g.type]}
                  <div>
                    <p className="text-sm font-bold text-slate-900">{g.name}</p>
                    {g.linkedAccountName && (
                      <p className="text-xs text-slate-400">{g.linkedAccountName}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(g.id)}
                  className="text-slate-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Progress */}
              {g.targetAmount && (
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>{fmt(g.currentAmount)}</span>
                    <span>{fmt(g.targetAmount)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full transition-all ${GOAL_COLORS[g.type]}`}
                      style={{ width: `${g.progressPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{g.progressPct.toFixed(1)}% complete</p>
                </div>
              )}

              {/* Emergency fund coverage */}
              {g.type === "emergency_fund" && g.targetMonths && (
                <div className="text-xs text-slate-600">
                  Target: {g.targetMonths} months of expenses
                  {g.targetAmount && (
                    <span className="ml-1 text-slate-400">({fmt(g.targetAmount)})</span>
                  )}
                </div>
              )}

              {/* Metadata */}
              <div className="space-y-1">
                {g.monthlyContribution && (
                  <p className="text-xs text-slate-500">
                    📅 Contributing {fmt(g.monthlyContribution)}/mo
                  </p>
                )}
                {g.type === "debt_payoff" && g.interestRate > 0 && (
                  <p className="text-xs text-slate-500">
                    📈 {g.interestRate}% APR
                    {interest !== null && isFinite(interest) && (
                      <span className="text-red-500 ml-1">· {fmt(interest)} total interest</span>
                    )}
                  </p>
                )}
                {g.projectedCompletionDate && (
                  <p className="text-xs text-emerald-600 font-medium">
                    ✓ On track for {fmtDate(g.projectedCompletionDate)}
                  </p>
                )}
                {g.targetDate && !g.projectedCompletionDate && (
                  <p className="text-xs text-amber-600">
                    🎯 Target: {fmtDate(g.targetDate)}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Add new goal card */}
        <button
          onClick={() => setAddOpen(true)}
          className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-5 flex flex-col items-center justify-center gap-2 hover:border-indigo-300 hover:bg-indigo-50 transition-colors min-h-[160px]"
        >
          <Plus className="h-6 w-6 text-slate-300" />
          <span className="text-sm text-slate-400">Add Goal</span>
        </button>
      </div>

      <GoalFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={() => router.refresh()}
        accounts={accounts}
      />
    </>
  );
}
```

- [ ] **Step 5: Create `src/app/(app)/goals/page.tsx`**

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listGoals, getMonthlySpendingAvg } from "@/lib/goals";
import { listAccounts } from "@/lib/accounts";
import { GoalsList } from "@/components/goals/goals-list";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default async function GoalsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const [goals, accounts, monthlySpend] = await Promise.all([
    listGoals(session.user.id),
    listAccounts(session.user.id),
    getMonthlySpendingAvg(session.user.id),
  ]);

  // Auto-compute emergency fund target on goals of type emergency_fund
  const enrichedGoals = goals.map((g) => {
    if (g.type === "emergency_fund" && g.targetMonths) {
      const target = monthlySpend * g.targetMonths;
      const months = target > 0 ? g.currentAmount / (monthlySpend || 1) : 0;
      return {
        ...g,
        targetAmount: target,
        progressPct: Math.min(100, (g.currentAmount / target) * 100),
      };
    }
    return g;
  });

  const totalTargeted = goals.reduce((s, g) => s + (g.targetAmount ?? 0), 0);
  const totalProgress = goals.reduce((s, g) => s + g.currentAmount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Financial Goals</h1>
        <p className="text-sm text-slate-500 mt-1">
          {goals.length} goals · {fmt(totalProgress)} saved toward {fmt(totalTargeted)} total
        </p>
      </div>

      {/* Emergency fund context */}
      {monthlySpend > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-600">
          Your avg monthly spend: <strong>{fmt(monthlySpend)}</strong> ·
          6-month emergency fund target: <strong>{fmt(monthlySpend * 6)}</strong>
        </div>
      )}

      <GoalsList
        initialGoals={enrichedGoals.map((g) => ({
          ...g,
          targetDate: g.targetDate?.toISOString() ?? null,
          projectedCompletionDate: g.projectedCompletionDate?.toISOString() ?? null,
        }))}
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          balance: a.balance,
        }))}
      />
    </div>
  );
}
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/lib/goals.ts src/app/api/goals/ src/components/goals/ src/app/(app)/goals/
git commit -m "feat: financial goals system with debt payoff calculator"
```

---

## Task 6: Unusual Spending Alerts

**Files:**
- Create: `src/lib/alerts.ts`
- Create: `src/components/dashboard/spending-alerts.tsx`
- Modify: `src/app/(app)/budgets/page.tsx`

- [ ] **Step 1: Create `src/lib/alerts.ts`**

```ts
import { db } from "./db";
import { transactions } from "./schema";
import { eq, and, gte, lte, ne, sql } from "drizzle-orm";

export type SpendingAlert = {
  category: string;
  currentAmount: number;
  avgAmount: number;
  pctOver: number; // e.g. 60 means 60% over average
  message: string;
};

const ALERT_THRESHOLD = 0.5;   // 50% over avg triggers alert
const MIN_ALERT_AMOUNT = 30;   // ignore categories with <$30 current spend

export async function getSpendingAlerts(userId: string): Promise<SpendingAlert[]> {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Current month spending by category
  const currentRows = await db
    .select({
      category: transactions.category,
      total: sql<string>`SUM(ABS(${transactions.amount}::numeric))`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, currentMonthStart),
        lte(transactions.date, currentMonthEnd),
        sql`${transactions.amount}::numeric < 0`,
        ne(transactions.category, "Transfer"),
        ne(transactions.category, "Income"),
        ne(transactions.category, "Investment"),
        ne(transactions.category, "Savings")
      )
    )
    .groupBy(transactions.category);

  // Last 3 complete months average by category
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const histRows = await db
    .select({
      category: transactions.category,
      total: sql<string>`SUM(ABS(${transactions.amount}::numeric))`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, threeMonthsAgo),
        lte(transactions.date, lastMonthEnd),
        sql`${transactions.amount}::numeric < 0`,
        ne(transactions.category, "Transfer"),
        ne(transactions.category, "Income"),
        ne(transactions.category, "Investment"),
        ne(transactions.category, "Savings")
      )
    )
    .groupBy(transactions.category);

  const historicalAvg: Record<string, number> = {};
  for (const row of histRows) {
    historicalAvg[row.category] = parseFloat(row.total ?? "0") / 3; // avg per month
  }

  const alerts: SpendingAlert[] = [];

  for (const row of currentRows) {
    const current = parseFloat(row.total ?? "0");
    const avg = historicalAvg[row.category] ?? 0;
    if (avg === 0 || current < MIN_ALERT_AMOUNT) continue;

    const pctOver = (current - avg) / avg;
    if (pctOver < ALERT_THRESHOLD) continue;

    alerts.push({
      category: row.category,
      currentAmount: current,
      avgAmount: avg,
      pctOver: Math.round(pctOver * 100),
      message: `You've spent ${Math.round(pctOver * 100)}% more on ${row.category} this month vs your 3-month average`,
    });
  }

  return alerts.sort((a, b) => b.pctOver - a.pctOver);
}
```

- [ ] **Step 2: Create `src/components/dashboard/spending-alerts.tsx`**

```tsx
"use client";
import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

type SpendingAlert = {
  category: string;
  currentAmount: number;
  avgAmount: number;
  pctOver: number;
  message: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function SpendingAlerts({ alerts }: { alerts: SpendingAlert[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = alerts.filter((a) => !dismissed.has(a.category));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((alert) => (
        <div
          key={alert.category}
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900">{alert.message}</p>
            <p className="text-xs text-amber-700 mt-0.5">
              This month: <strong>{fmt(alert.currentAmount)}</strong> · 3-month avg: <strong>{fmt(alert.avgAmount)}</strong>
            </p>
          </div>
          <button
            onClick={() => setDismissed((prev) => new Set([...Array.from(prev), alert.category]))}
            className="text-amber-400 hover:text-amber-600 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Wire alerts into budgets page**

In `src/app/(app)/budgets/page.tsx`, add the import at the top:

```ts
import { getSpendingAlerts } from "@/lib/alerts";
import { SpendingAlerts } from "@/components/dashboard/spending-alerts";
```

In the `Promise.all` call, add `getSpendingAlerts(session.user.id)`:

```ts
const [budgets, topTxByCategory, alerts] = await Promise.all([
  listBudgetsWithSpending(session.user.id, month, year),
  getTopTransactionsByCategory(session.user.id, month, year, 5),
  getSpendingAlerts(session.user.id),
]);
```

In the JSX, add `<SpendingAlerts alerts={alerts} />` before `<BudgetsList`:

```tsx
<SpendingAlerts alerts={alerts} />
<BudgetsList ... />
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/lib/alerts.ts src/components/dashboard/spending-alerts.tsx src/app/(app)/budgets/page.tsx
git commit -m "feat: unusual spending alerts on budget page"
```

---

## Task 7: Navigation + Polish

**Files:**
- Modify: sidebar/nav component (find with `grep -r "budgets" src/components/layout` or `src/components/nav`)

- [ ] **Step 1: Find the nav file**

```bash
grep -r "budgets" "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal/src/components" --include="*.tsx" -l
```

Look for the file that renders the sidebar navigation links.

- [ ] **Step 2: Add new nav links**

In the nav array (wherever "Budgets", "Reports", etc. are listed), add:

```tsx
{ href: "/recurring", label: "Recurring", icon: RepeatIcon },
{ href: "/calendar",  label: "Bill Calendar", icon: CalendarIcon },
{ href: "/goals",     label: "Goals", icon: TargetIcon },
```

Import from lucide-react:
```ts
import { Repeat, Calendar, Target } from "lucide-react";
```

- [ ] **Step 3: Final type-check and build**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: add Recurring, Calendar, Goals to navigation"
```

---

## Self-Review Checklist

| Feature | Covered |
|---|---|
| Recurring detection algorithm (normalize → interval → frequency classify) | ✅ Task 2 |
| Subscription flag toggle | ✅ Task 3 |
| Annual cost display | ✅ Task 3 |
| Upcoming bill calendar (2 months, click for detail) | ✅ Task 4 |
| Income dots on calendar | ✅ Task 4 |
| Goals: savings, debt payoff, emergency fund types | ✅ Task 5 |
| Debt payoff amortization math | ✅ Task 5 |
| Total interest calculation | ✅ Task 5 |
| Emergency fund months-of-expenses | ✅ Task 5 |
| Linked account auto-pulls balance | ✅ Task 5 |
| Unusual spending alerts (50% threshold, $30 floor) | ✅ Task 6 |
| Dismissable alerts | ✅ Task 6 |
| Nav links for all 3 new pages | ✅ Task 7 |
| DB migration script | ✅ Task 1 |
