# Dashboard Accounts, Dark Mode, Investments & PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four features: per-account spending breakdown on the dashboard, full dark mode with system-preference detection, an investment portfolio page with Plaid holdings sync, and PWA support so the app is installable on iOS/Android.

**Architecture:** Dark mode uses Tailwind's `class` strategy with an inline `<script>` in `<head>` to set the class synchronously (no flash), persisted to `localStorage`. Investment holdings get a new `holdings` DB table and a Plaid `/investments/holdings/get` sync. PWA uses a hand-written `public/sw.js` service worker (no extra npm packages) with a `public/manifest.json`. Dashboard account breakdown adds one new server query and one new client component.

**Tech Stack:** Next.js 14 App Router, Drizzle ORM + Neon Postgres, Tailwind CSS (darkMode: "class"), Recharts (PieChart), Lucide icons, Plaid Node SDK, sharp (already bundled with Next.js).

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `src/lib/theme.tsx` | ThemeProvider context + useTheme hook |
| `src/components/ui/theme-toggle.tsx` | Sun/Moon icon button |
| `src/components/dashboard/account-breakdown.tsx` | Per-account income/expense table on dashboard |
| `src/lib/investments.ts` | `listHoldings`, `getPortfolioSummary` queries |
| `src/components/investments/allocation-chart.tsx` | Recharts PieChart for asset allocation |
| `src/components/investments/holdings-table.tsx` | Holdings table with ticker, value, gain/loss |
| `src/app/(app)/investments/page.tsx` | Investments server page |
| `src/app/api/plaid/sync-holdings/route.ts` | POST: sync investment holdings for one item |
| `scripts/add-holdings-table.ts` | DB migration: create holdings table |
| `scripts/generate-pwa-icons.ts` | Generate PNG icons using sharp |
| `public/manifest.json` | PWA manifest |
| `public/sw.js` | Service worker (cache-first for static, network-first for pages) |
| `src/components/pwa/install-prompt.tsx` | "Add to Home Screen" banner |

### Modified files
| File | Change |
|---|---|
| `tailwind.config.ts` | Add `darkMode: "class"` |
| `src/app/globals.css` | Dark mode CSS variables |
| `src/app/layout.tsx` | ThemeProvider + PWA meta tags + flash-prevention script |
| `src/app/(app)/layout.tsx` | Dark variants on app shell |
| `src/components/layout/sidebar.tsx` | Dark variants + ThemeToggle + Investments link |
| `src/app/(app)/dashboard/page.tsx` | Fetch account breakdown + render component |
| `src/lib/dashboard.ts` | Add `getAccountBreakdown()` query |
| `src/lib/schema.ts` | Add `holdings` table definition |
| `src/lib/plaid.ts` | Add `syncInvestmentHoldings()` function |
| `src/app/api/plaid/sync/route.ts` | Call holdings sync after transaction sync |

---

## Task 1: Multi-Account Totals on Dashboard

**Files:**
- Modify: `src/lib/dashboard.ts`
- Create: `src/components/dashboard/account-breakdown.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Add `getAccountBreakdown` to dashboard.ts**

Add this function at the bottom of `src/lib/dashboard.ts`. Also add `accounts` to the import from schema and add `desc` is already imported. Add `ne` to drizzle-orm imports:

```ts
import { eq, and, gte, lte, sql, desc, ne } from "drizzle-orm";
import { transactions, netWorthSnapshots, accounts } from "./schema";
```

Then add the function:

```ts
export type AccountBreakdown = {
  accountId: string;
  accountName: string;
  accountType: string;
  income: number;
  expenses: number;
  net: number;
};

export async function getAccountBreakdown(
  userId: string,
  month: number,
  year: number
): Promise<AccountBreakdown[]> {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const rows = await db
    .select({
      accountId: accounts.id,
      accountName: accounts.name,
      accountType: accounts.type,
      income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.amount}::numeric > 0 AND ${transactions.category}::text != 'Transfer' THEN ${transactions.amount}::numeric ELSE 0 END), 0)`,
      expenses: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.amount}::numeric < 0 AND ${transactions.category}::text != 'Transfer' THEN ABS(${transactions.amount}::numeric) ELSE 0 END), 0)`,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, firstDay),
        lte(transactions.date, lastDay)
      )
    )
    .groupBy(accounts.id, accounts.name, accounts.type)
    .orderBy(desc(sql`SUM(ABS(${transactions.amount}::numeric))`));

  return rows.map((r) => ({
    accountId: r.accountId,
    accountName: r.accountName,
    accountType: r.accountType,
    income: parseFloat(r.income),
    expenses: parseFloat(r.expenses),
    net: parseFloat(r.income) - parseFloat(r.expenses),
  }));
}
```

- [ ] **Step 2: Create `src/components/dashboard/account-breakdown.tsx`**

```tsx
"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type AccountBreakdown = {
  accountId: string;
  accountName: string;
  accountType: string;
  income: number;
  expenses: number;
  net: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

const TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  credit: "Credit Card",
  investment: "Investment",
  loan: "Loan",
  retirement: "Retirement",
  crypto: "Crypto",
  real_estate: "Real Estate",
  vehicle: "Vehicle",
};

export function AccountBreakdown({ accounts }: { accounts: AccountBreakdown[] }) {
  const [open, setOpen] = useState(false);

  const active = accounts.filter((a) => a.income > 0 || a.expenses > 0);
  if (active.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white text-left">
            Activity by Account
          </p>
          <p className="text-xs text-slate-400 mt-0.5 text-left">
            {active.length} accounts with transactions this month
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-4 px-5 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Account</span>
            <span className="text-right">Income</span>
            <span className="text-right">Expenses</span>
            <span className="text-right">Net</span>
          </div>
          {active.map((acct) => (
            <div
              key={acct.accountId}
              className="grid grid-cols-4 px-5 py-3 border-t border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                  {acct.accountName}
                </p>
                <p className="text-xs text-slate-400">
                  {TYPE_LABELS[acct.accountType] ?? acct.accountType}
                </p>
              </div>
              <p className="text-sm tabular-nums text-right text-emerald-600 dark:text-emerald-400 self-center">
                {acct.income > 0 ? `+${fmt(acct.income)}` : "—"}
              </p>
              <p className="text-sm tabular-nums text-right text-red-500 dark:text-red-400 self-center">
                {acct.expenses > 0 ? `−${fmt(acct.expenses)}` : "—"}
              </p>
              <p
                className={`text-sm tabular-nums font-semibold text-right self-center ${
                  acct.net >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500 dark:text-red-400"
                }`}
              >
                {acct.net >= 0 ? "+" : ""}
                {fmt(acct.net)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire into dashboard page**

Read `src/app/(app)/dashboard/page.tsx`, then add:

```ts
import { getDashboardData, getAccountBreakdown } from "@/lib/dashboard";
import { AccountBreakdown } from "@/components/dashboard/account-breakdown";
```

In the server component, add to the data fetching:

```ts
const [data, accountBreakdown] = await Promise.all([
  getDashboardData(session.user.id),
  getAccountBreakdown(session.user.id, new Date().getMonth() + 1, new Date().getFullYear()),
]);
```

Add `<AccountBreakdown accounts={accountBreakdown} />` at the bottom of the JSX, after the recent transactions section.

- [ ] **Step 4: Type-check and commit**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
npx tsc --noEmit
git add src/lib/dashboard.ts src/components/dashboard/account-breakdown.tsx src/app/'(app)'/dashboard/page.tsx
git commit -m "feat: per-account income/expense breakdown on dashboard"
```

---

## Task 2: Dark Mode — Infrastructure

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`
- Create: `src/lib/theme.tsx`
- Create: `src/components/ui/theme-toggle.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Enable Tailwind dark mode**

In `tailwind.config.ts`, change:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",   // ← ADD THIS LINE
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Add dark mode CSS variables to globals.css**

Read `src/app/globals.css`, then add dark-mode variable overrides:

```css
/* Existing light mode variables stay unchanged */

@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    --background: #0f172a;
    --foreground: #f8fafc;
  }
}

.dark {
  --background: #0f172a;
  --foreground: #f8fafc;
}

/* Smooth transition on theme change */
*, *::before, *::after {
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
```

- [ ] **Step 3: Create `src/lib/theme.tsx`**

```tsx
"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Read persisted preference
    const stored = (localStorage.getItem("theme") as Theme) ?? "system";
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  function applyTheme(t: Theme) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = t === "dark" || (t === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
    setResolvedTheme(isDark ? "dark" : "light");
  }

  function setTheme(t: Theme) {
    localStorage.setItem("theme", t);
    setThemeState(t);
    applyTheme(t);
  }

  // Keep in sync with system preference changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (theme === "system") applyTheme("system"); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 4: Create `src/components/ui/theme-toggle.tsx`**

```tsx
"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex items-center justify-center h-8 w-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
      title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
```

- [ ] **Step 5: Update `src/app/layout.tsx`**

Replace the entire file:

```tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/lib/theme";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MoneyPlan",
  description: "Personal finance tracking and AI insights",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MoneyPlan",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Synchronously apply theme before paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.classList.toggle('light',!d);}catch(e){}})();`,
          }}
        />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className={inter.className}>
        <SessionProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Type-check and commit**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
npx tsc --noEmit
git add tailwind.config.ts src/app/globals.css src/lib/theme.tsx src/components/ui/theme-toggle.tsx src/app/layout.tsx
git commit -m "feat: dark mode infrastructure — Tailwind class strategy, ThemeProvider, flash-prevention script"
```

---

## Task 3: Dark Mode — Apply to Sidebar and App Shell

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Read the current app layout**

Read `src/app/(app)/layout.tsx` to see its current structure.

- [ ] **Step 2: Update app shell with dark variants**

The `(app)/layout.tsx` wraps all authenticated pages. It likely has a sidebar + main content structure. Apply dark mode classes. The full updated file should look like:

```tsx
import { Sidebar } from "@/components/layout/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
```

(Adjust to match actual content in the file — preserve any existing wrappers, just add the dark: variants.)

- [ ] **Step 3: Update sidebar with dark variants and ThemeToggle**

Read `src/components/layout/sidebar.tsx`, then apply dark variants. Key changes:

```tsx
// Import ThemeToggle
import { ThemeToggle } from "@/components/ui/theme-toggle";

// Sidebar container: was bg-white border-r
<aside className="flex h-full w-60 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-4">

// Brand text: was text-slate-900
<span className="text-xl font-bold text-slate-900 dark:text-white">MoneyPlan</span>

// Nav links inactive: was text-slate-500 hover:bg-slate-50 hover:text-slate-900
className={cn(
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
  pathname === href
    ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
)}

// Bottom section: add ThemeToggle next to Settings
<div className="space-y-1 border-t border-slate-200 dark:border-slate-800 pt-3">
  {/* existing bottom items */}
  <div className="px-3 py-2 flex items-center justify-between">
    <span className="text-xs text-slate-400 dark:text-slate-500">Theme</span>
    <ThemeToggle />
  </div>
</div>
```

Also add the Investments nav link to `navItems` array:

```tsx
import { BarChart2, Calendar, Flag, Home, List, RefreshCw, Repeat, Settings, Target, TrendingUp, Wallet } from "lucide-react";

// Add to navItems array (after Goals):
{ href: "/investments", label: "Investments", icon: BarChart2 },
```

- [ ] **Step 4: Type-check and commit**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
npx tsc --noEmit
git add src/app/'(app)'/layout.tsx src/components/layout/sidebar.tsx
git commit -m "feat: dark mode on app shell and sidebar, add ThemeToggle and Investments nav link"
```

---

## Task 4: Investment Holdings — DB Schema + Plaid Sync

**Files:**
- Modify: `src/lib/schema.ts`
- Create: `scripts/add-holdings-table.ts`
- Modify: `src/lib/plaid.ts`
- Create: `src/lib/investments.ts`

- [ ] **Step 1: Add holdings table to schema.ts**

Read `src/lib/schema.ts`, then add at the bottom (after the `goals` table):

```ts
export const holdings = pgTable("holdings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  plaidSecurityId: text("plaid_security_id"),
  ticker: text("ticker"),                        // e.g. "AAPL", null for mutual funds
  name: text("name").notNull(),                  // e.g. "Apple Inc."
  securityType: text("security_type"),           // "equity", "etf", "mutual fund", "cash", "other"
  quantity: numeric("quantity", { precision: 16, scale: 6 }),
  price: numeric("price", { precision: 12, scale: 4 }),           // current price per share
  marketValue: numeric("market_value", { precision: 12, scale: 2 }).notNull(),
  costBasis: numeric("cost_basis", { precision: 12, scale: 2 }),   // total cost basis (null if unavailable)
  lastSynced: timestamp("last_synced", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("holdings_user_id_idx").on(t.userId),
  uniqueIndex("holdings_user_security_idx").on(t.userId, t.plaidSecurityId),
]);
```

Also add `index, uniqueIndex` to the drizzle-orm/pg-core import line if not already present.

- [ ] **Step 2: Create migration script**

Create `scripts/add-holdings-table.ts`:

```ts
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS holdings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
      plaid_security_id TEXT,
      ticker TEXT,
      name TEXT NOT NULL,
      security_type TEXT,
      quantity NUMERIC(16, 6),
      price NUMERIC(12, 4),
      market_value NUMERIC(12, 2) NOT NULL,
      cost_basis NUMERIC(12, 2),
      last_synced TIMESTAMP DEFAULT NOW() NOT NULL,
      UNIQUE(user_id, plaid_security_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS holdings_user_id_idx ON holdings(user_id)`;
  console.log("holdings table created");
}

main().catch(console.error);
```

- [ ] **Step 3: Run migration**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
npx tsx scripts/add-holdings-table.ts
```

Expected output: `holdings table created`

- [ ] **Step 4: Add `syncInvestmentHoldings` to plaid.ts**

Read `src/lib/plaid.ts`, then add these imports and function. Add to the existing imports:

```ts
import { holdings } from "./schema";
```

Add at the end of the file:

```ts
export async function syncInvestmentHoldings(
  userId: string,
  accessToken: string
): Promise<number> {
  let response;
  try {
    response = await plaidClient.investmentsHoldingsGet({
      access_token: accessToken,
    });
  } catch (err: unknown) {
    // Investment product not enabled for this item — skip silently
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("PRODUCT_NOT_READY") || msg.includes("INVALID_PRODUCT")) {
      return 0;
    }
    throw err;
  }

  const { holdings: plaidHoldings, securities } = response.data;

  // Build security lookup map: securityId → security details
  const securityMap = new Map(
    securities.map((s) => [s.security_id, s])
  );

  let synced = 0;

  for (const h of plaidHoldings) {
    const security = securityMap.get(h.security_id);
    if (!security) continue;

    // Find account by plaidAccountId
    const [acct] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.plaidAccountId, h.account_id),
          eq(accounts.userId, userId)
        )
      )
      .limit(1);

    const securityType = security.type?.toLowerCase() ?? "other";
    const ticker = security.ticker_symbol ?? null;
    const name = security.name ?? security.ticker_symbol ?? "Unknown";

    await db
      .insert(holdings)
      .values({
        id: crypto.randomUUID(),
        userId,
        accountId: acct?.id ?? null,
        plaidSecurityId: h.security_id,
        ticker,
        name,
        securityType,
        quantity: h.quantity != null ? String(h.quantity) : null,
        price: h.institution_price != null ? String(h.institution_price) : null,
        marketValue: String(h.institution_value ?? 0),
        costBasis: h.cost_basis != null ? String(h.cost_basis) : null,
        lastSynced: new Date(),
      })
      .onConflictDoUpdate({
        target: [holdings.userId, holdings.plaidSecurityId],
        set: {
          quantity: h.quantity != null ? String(h.quantity) : null,
          price: h.institution_price != null ? String(h.institution_price) : null,
          marketValue: String(h.institution_value ?? 0),
          costBasis: h.cost_basis != null ? String(h.cost_basis) : null,
          lastSynced: new Date(),
        },
      });

    synced++;
  }

  return synced;
}
```

- [ ] **Step 5: Create `src/lib/investments.ts`**

```ts
import { db } from "./db";
import { holdings, accounts } from "./schema";
import { eq } from "drizzle-orm";

export type Holding = {
  id: string;
  ticker: string | null;
  name: string;
  securityType: string;
  quantity: number | null;
  price: number | null;
  marketValue: number;
  costBasis: number | null;
  gainLoss: number | null;        // marketValue - costBasis
  gainLossPct: number | null;     // gainLoss / costBasis * 100
  accountName: string | null;
  lastSynced: Date;
};

export type PortfolioSummary = {
  totalValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  totalGainLossPct: number;
  byType: { type: string; value: number; pct: number }[];
};

export async function listHoldings(userId: string): Promise<Holding[]> {
  const rows = await db
    .select({
      holding: holdings,
      accountName: accounts.name,
    })
    .from(holdings)
    .leftJoin(accounts, eq(holdings.accountId, accounts.id))
    .where(eq(holdings.userId, userId))
    .orderBy(holdings.marketValue);

  return rows
    .map(({ holding: h, accountName }) => {
      const mv = parseFloat(h.marketValue);
      const cb = h.costBasis ? parseFloat(h.costBasis) : null;
      const gl = cb !== null ? mv - cb : null;
      const glPct = cb !== null && cb > 0 ? (gl! / cb) * 100 : null;

      return {
        id: h.id,
        ticker: h.ticker,
        name: h.name,
        securityType: h.securityType ?? "other",
        quantity: h.quantity ? parseFloat(h.quantity) : null,
        price: h.price ? parseFloat(h.price) : null,
        marketValue: mv,
        costBasis: cb,
        gainLoss: gl,
        gainLossPct: glPct,
        accountName: accountName ?? null,
        lastSynced: h.lastSynced,
      };
    })
    .sort((a, b) => b.marketValue - a.marketValue); // sort descending
}

export async function getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
  const all = await listHoldings(userId);

  const totalValue = all.reduce((s, h) => s + h.marketValue, 0);
  const totalCostBasis = all.reduce((s, h) => s + (h.costBasis ?? h.marketValue), 0);
  const totalGainLoss = totalValue - totalCostBasis;
  const totalGainLossPct = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;

  // Group by security type
  const typeMap = new Map<string, number>();
  for (const h of all) {
    const t = h.securityType;
    typeMap.set(t, (typeMap.get(t) ?? 0) + h.marketValue);
  }

  const byType = Array.from(typeMap.entries())
    .map(([type, value]) => ({
      type,
      value,
      pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  return { totalValue, totalCostBasis, totalGainLoss, totalGainLossPct, byType };
}
```

- [ ] **Step 6: Type-check and commit**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
npx tsc --noEmit
git add src/lib/schema.ts scripts/add-holdings-table.ts src/lib/plaid.ts src/lib/investments.ts
git commit -m "feat: holdings DB table, Plaid investment sync, and portfolio query functions"
```

---

## Task 5: Investment Portfolio — UI + API Route

**Files:**
- Create: `src/components/investments/allocation-chart.tsx`
- Create: `src/components/investments/holdings-table.tsx`
- Create: `src/app/api/plaid/sync-holdings/route.ts`
- Create: `src/app/(app)/investments/page.tsx`

- [ ] **Step 1: Create `src/components/investments/allocation-chart.tsx`**

```tsx
"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ["#6366f1", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16"];

type Props = {
  byType: { type: string; value: number; pct: number }[];
  totalValue: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

const TYPE_LABELS: Record<string, string> = {
  equity: "Stocks",
  etf: "ETFs",
  "mutual fund": "Mutual Funds",
  "fixed income": "Bonds",
  cash: "Cash",
  derivative: "Derivatives",
  other: "Other",
};

export function AllocationChart({ byType, totalValue }: Props) {
  if (byType.length === 0) return null;

  const data = byType.map((t) => ({
    name: TYPE_LABELS[t.type] ?? t.type,
    value: t.value,
    pct: t.pct,
  }));

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Asset Allocation</h3>
      <p className="text-xs text-slate-400 mb-4">Total: {fmt(totalValue)}</p>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              dataKey="value"
              strokeWidth={2}
              stroke="transparent"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => [fmt(Number(v)), ""]}
              contentStyle={{ borderRadius: "8px", fontSize: "12px", border: "1px solid #e2e8f0" }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex-1 space-y-2">
          {data.map((entry, i) => (
            <div key={entry.name} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">{entry.name}</span>
              <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                {fmt(entry.value)}
              </span>
              <span className="text-xs text-slate-400 w-10 text-right">
                {entry.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/investments/holdings-table.tsx`**

```tsx
"use client";
import { useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Holding = {
  id: string;
  ticker: string | null;
  name: string;
  securityType: string;
  quantity: number | null;
  price: number | null;
  marketValue: number;
  costBasis: number | null;
  gainLoss: number | null;
  gainLossPct: number | null;
  accountName: string | null;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

function fmtQty(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(n);
}

export function HoldingsTable({
  holdings,
  plaidItemId,
}: {
  holdings: Holding[];
  plaidItemId: string | null;
}) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  async function syncHoldings() {
    if (!plaidItemId) return;
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/plaid/sync-holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plaidItemId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(`✓ ${data.synced} holdings updated`);
      router.refresh();
    } catch {
      setResult("Sync failed. Try again.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Holdings</h3>
          <p className="text-xs text-slate-400 mt-0.5">{holdings.length} positions</p>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <span className={`text-xs ${result.startsWith("✓") ? "text-emerald-600" : "text-red-500"}`}>
              {result}
            </span>
          )}
          {plaidItemId && (
            <Button variant="outline" size="sm" onClick={syncHoldings} disabled={syncing} className="gap-1.5">
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {syncing ? "Syncing…" : "Sync"}
            </Button>
          )}
        </div>
      </div>

      {holdings.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-slate-400 text-sm">No holdings found.</p>
          <p className="text-slate-400 text-xs mt-1">
            Connect an investment account via Plaid or click Sync.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                {["Ticker / Name", "Qty", "Price", "Market Value", "Gain / Loss"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider last:text-right"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr
                  key={h.id}
                  className="border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {h.ticker ?? "—"}
                    </p>
                    <p className="text-xs text-slate-400 truncate max-w-[180px]">{h.name}</p>
                  </td>
                  <td className="px-5 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                    {h.quantity !== null ? fmtQty(h.quantity) : "—"}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                    {h.price !== null ? fmt(h.price) : "—"}
                  </td>
                  <td className="px-5 py-3 tabular-nums font-semibold text-slate-900 dark:text-white">
                    {fmt(h.marketValue)}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-right">
                    {h.gainLoss !== null ? (
                      <div>
                        <p className={h.gainLoss >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}>
                          {h.gainLoss >= 0 ? "+" : ""}
                          {fmt(h.gainLoss)}
                        </p>
                        <p className={`text-xs ${h.gainLoss >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                          {h.gainLossPct !== null
                            ? `${h.gainLossPct >= 0 ? "+" : ""}${h.gainLossPct.toFixed(2)}%`
                            : ""}
                        </p>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/api/plaid/sync-holdings/route.ts`**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { decryptToken, syncInvestmentHoldings } from "@/lib/plaid";
import { db } from "@/lib/db";
import { accounts } from "@/lib/schema";
import { and, eq } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plaidItemId } = await req.json();
  if (!plaidItemId) return NextResponse.json({ error: "plaidItemId required" }, { status: 400 });

  const [acct] = await db
    .select({ plaidAccessToken: accounts.plaidAccessToken })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, session.user.id),
        eq(accounts.plaidItemId, plaidItemId)
      )
    )
    .limit(1);

  if (!acct?.plaidAccessToken) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const accessToken = decryptToken(acct.plaidAccessToken);
  const synced = await syncInvestmentHoldings(session.user.id, accessToken);
  return NextResponse.json({ synced });
}
```

- [ ] **Step 4: Create `src/app/(app)/investments/page.tsx`**

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listHoldings, getPortfolioSummary } from "@/lib/investments";
import { AllocationChart } from "@/components/investments/allocation-chart";
import { HoldingsTable } from "@/components/investments/holdings-table";
import { db } from "@/lib/db";
import { accounts } from "@/lib/schema";
import { and, eq, isNotNull } from "drizzle-orm";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default async function InvestmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const [allHoldings, summary] = await Promise.all([
    listHoldings(session.user.id),
    getPortfolioSummary(session.user.id),
  ]);

  // Get a Plaid item ID for the sync button (use first connected investment account)
  const [investAcct] = await db
    .select({ plaidItemId: accounts.plaidItemId })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, session.user.id),
        eq(accounts.type, "investment"),
        isNotNull(accounts.plaidItemId)
      )
    )
    .limit(1);

  const hasGainLoss = summary.totalGainLoss !== 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Investments</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {allHoldings.length} positions · {fmt(summary.totalValue)} total value
          {hasGainLoss && (
            <span
              className={`ml-2 font-semibold ${
                summary.totalGainLoss >= 0 ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {summary.totalGainLoss >= 0 ? "+" : ""}
              {fmt(summary.totalGainLoss)} (
              {summary.totalGainLossPct >= 0 ? "+" : ""}
              {summary.totalGainLossPct.toFixed(2)}%)
            </span>
          )}
        </p>
      </div>

      {allHoldings.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center">
          <p className="text-slate-400 text-sm">No holdings found.</p>
          <p className="text-slate-400 text-xs mt-1">
            Connect an investment account (Robinhood, Fidelity, etc.) via Plaid on the Net Worth page.
          </p>
        </div>
      ) : (
        <>
          <AllocationChart byType={summary.byType} totalValue={summary.totalValue} />
          <HoldingsTable
            holdings={allHoldings}
            plaidItemId={investAcct?.plaidItemId ?? null}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Type-check and commit**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
npx tsc --noEmit
git add src/components/investments/ src/app/'(app)'/investments/ src/app/api/plaid/sync-holdings/
git commit -m "feat: investment portfolio page with allocation chart and holdings table"
```

---

## Task 6: PWA — Manifest, Icons, and Meta Tags

**Files:**
- Create: `scripts/generate-pwa-icons.ts`
- Create: `public/manifest.json`
- Modify: `src/app/layout.tsx` (already done in Task 2)

- [ ] **Step 1: Create icon generation script**

Create `scripts/generate-pwa-icons.ts`:

```ts
import sharp from "sharp";
import { mkdirSync } from "fs";

mkdirSync("public/icons", { recursive: true });

// SVG source: indigo circle with "M" letter
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#6366f1"/>
  <text x="256" y="340" font-family="Arial,sans-serif" font-size="280" font-weight="bold"
    fill="white" text-anchor="middle">M</text>
</svg>`;

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

async function generate() {
  for (const { name, size } of sizes) {
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(`public/icons/${name}`);
    console.log(`Generated public/icons/${name}`);
  }
}

generate().catch(console.error);
```

- [ ] **Step 2: Run icon generation**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
npx tsx scripts/generate-pwa-icons.ts
```

Expected output:
```
Generated public/icons/icon-192.png
Generated public/icons/icon-512.png
Generated public/icons/apple-touch-icon.png
```

- [ ] **Step 3: Create `public/manifest.json`**

```json
{
  "name": "MoneyPlan",
  "short_name": "MoneyPlan",
  "description": "Personal finance tracking and AI insights",
  "start_url": "/dashboard",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#ffffff",
  "theme_color": "#6366f1",
  "categories": ["finance", "productivity"],
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [],
  "shortcuts": [
    {
      "name": "Dashboard",
      "url": "/dashboard",
      "description": "View your financial overview"
    },
    {
      "name": "Transactions",
      "url": "/transactions",
      "description": "Review your transactions"
    }
  ]
}
```

- [ ] **Step 4: Type-check and commit**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
npx tsc --noEmit
git add public/manifest.json public/icons/ scripts/generate-pwa-icons.ts
git commit -m "feat: PWA manifest and app icons (192px, 512px, Apple touch icon)"
```

---

## Task 7: PWA — Service Worker + Install Prompt

**Files:**
- Create: `public/sw.js`
- Create: `src/components/pwa/install-prompt.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Create `public/sw.js`**

```js
const CACHE_NAME = "moneyplan-v1";

// Static assets to cache on install
const PRECACHE_URLS = [
  "/",
  "/dashboard",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Delete old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API routes: network-first (never serve stale API data)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: "Offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // Static assets (_next/static): cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached ?? fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Pages: network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        return res;
      })
      .catch(() => caches.match(request))
  );
});
```

- [ ] **Step 2: Create `src/components/pwa/install-prompt.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }

    // Capture the install prompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Don't show if dismissed or already dismissed in this session
  if (!prompt || dismissed) return null;

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setPrompt(null);
    setDismissed(true);
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg px-4 py-3 max-w-sm w-full mx-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          Install MoneyPlan
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Add to your home screen for quick access
        </p>
      </div>
      <button
        onClick={install}
        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        Install
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Add InstallPrompt to `src/app/(app)/layout.tsx`**

Read the file, then add:

```tsx
import { InstallPrompt } from "@/components/pwa/install-prompt";
```

And add `<InstallPrompt />` at the end of the layout's JSX (inside the outermost div, after `<main>`).

- [ ] **Step 4: Final type-check, commit, and push**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
npx tsc --noEmit
git add public/sw.js src/components/pwa/ src/app/'(app)'/layout.tsx
git commit -m "feat: service worker with cache-first static / network-first pages, install prompt banner"
git push origin claude/lucid-pascal
```

---

## Self-Review Checklist

| Requirement | Task |
|---|---|
| Per-account income/expense breakdown on dashboard | Task 1 |
| Collapsible — doesn't clutter dashboard for small screens | Task 1 (default `open=false`) |
| Dark mode via Tailwind `class` strategy | Task 2 |
| No flash of wrong theme on reload | Task 2 (inline script in `<head>`) |
| System `prefers-color-scheme` default | Task 2 (ThemeProvider logic) |
| Persisted to localStorage | Task 2 (ThemeProvider `setTheme`) |
| Sun/Moon toggle in sidebar | Task 3 |
| App shell + sidebar get dark variants | Task 3 |
| Plaid investment holdings sync | Task 4 |
| Holdings DB table with migration script | Task 4 |
| Asset allocation pie chart | Task 5 |
| Holdings table with gain/loss | Task 5 |
| Investments page at `/investments` | Task 5 |
| Investments nav link in sidebar | Task 3 (added BarChart2 link) |
| `public/manifest.json` | Task 6 |
| Icons at 192px, 512px, Apple 180px | Task 6 |
| PWA meta tags in layout | Task 2 (layout.tsx) |
| Service worker registration | Task 7 (InstallPrompt useEffect) |
| Cache-first static, network-first pages | Task 7 (sw.js) |
| Install prompt banner (Android Chrome) | Task 7 |
