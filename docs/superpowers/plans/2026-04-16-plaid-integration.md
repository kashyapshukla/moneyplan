# Plaid Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Plaid Link so users can connect real bank accounts on the Net Worth page, with a manual "Sync Now" button that upserts live balances and transactions into the existing DB.

**Architecture:** Plaid's Node SDK (`plaid`) creates a `link_token` server-side, the browser opens Plaid Link (`react-plaid-link`), on success a `public_token` is exchanged server-side for a permanent AES-256-encrypted `access_token` stored in the accounts table. "Sync Now" decrypts the token, calls Plaid's transactions + accounts APIs, and upserts into the existing `accounts` and `transactions` tables. The `transaction_source = "plaid"` enum value is already in the schema.

**Tech Stack:** Next.js 14 App Router, `plaid` Node SDK, `react-plaid-link`, Drizzle ORM + Neon Postgres, Node `crypto` (AES-256-CBC), Tailwind CSS, TypeScript.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `.env.local` | Modify | Add `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `PLAID_ENCRYPTION_KEY` |
| `.env.example` | Modify | Document the four new env vars |
| `src/lib/schema.ts` | Modify | Add `plaidAccountId`, `plaidAccessToken`, `plaidItemId` to `accounts`; add `plaidTransactionId` to `transactions` |
| `src/lib/plaid.ts` | Create | Plaid SDK client singleton, `encryptToken`/`decryptToken`, `mapPlaidCategory`, `mapPlaidAccountType`, `syncPlaidItem` |
| `src/lib/__tests__/plaid.test.ts` | Create | Unit tests for pure helper functions |
| `src/app/api/plaid/create-link-token/route.ts` | Create | `POST` — auth check, create Plaid link token, return to browser |
| `src/app/api/plaid/exchange-token/route.ts` | Create | `POST` — exchange public token, encrypt + store access token, upsert accounts, run initial sync |
| `src/app/api/plaid/sync/route.ts` | Create | `POST` — decrypt access token by itemId, call syncPlaidItem, return ok |
| `src/components/net-worth/plaid-connect-button.tsx` | Create | Client component — fetches link token, opens Plaid Link, calls exchange-token on success |
| `src/components/net-worth/accounts-list.tsx` | Modify | Add `plaidAccountId`/`plaidItemId` to Account type, show 🏦 badge + Sync Now, hide edit for Plaid accounts |
| `src/app/(app)/net-worth/page.tsx` | Modify | Add `<PlaidConnectButton>` to page header, pass `plaidAccountId`/`plaidItemId` from `listAccounts` |

---

## Task 1: Install packages + configure environment

**Files:**
- Modify: `.env.local`
- Modify: `.env.example`

- [ ] **Step 1: Install Plaid packages**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
npm install plaid react-plaid-link
npm install --save-dev @types/react-plaid-link
```

- [ ] **Step 2: Generate a 32-byte encryption key**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output — it's your `PLAID_ENCRYPTION_KEY`.

- [ ] **Step 3: Add env vars to `.env.local`**

Add these four lines (replace `<generated-key>` with the output from Step 2):

```
PLAID_CLIENT_ID=697fbde6b9ad48001ed47bd8
PLAID_SECRET=799f4368f4efaa24ea7760038cefb3
PLAID_ENV=sandbox
PLAID_ENCRYPTION_KEY=<generated-key>
```

- [ ] **Step 4: Update `.env.example`**

Read `.env.example`, then add:

```
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_sandbox_or_production_secret
PLAID_ENV=sandbox
PLAID_ENCRYPTION_KEY=64_hex_chars_from_node_crypto_randomBytes_32
```

- [ ] **Step 5: Commit**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
git add .env.example package.json package-lock.json
git commit -m "chore: install plaid + react-plaid-link, document env vars"
```

---

## Task 2: Add Plaid columns to schema + run migration

**Files:**
- Modify: `src/lib/schema.ts`

- [ ] **Step 1: Add columns to `accounts` table in `src/lib/schema.ts`**

Find the `accounts` table definition. Add three columns after `lastUpdated`:

```typescript
export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: accountTypeEnum("type").notNull(),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("USD"),
  lastUpdated: timestamp("last_updated", { mode: "date" }).defaultNow().notNull(),
  // Plaid integration — null for manually-added accounts
  plaidAccountId: text("plaid_account_id").unique(),
  plaidAccessToken: text("plaid_access_token"), // AES-256 encrypted
  plaidItemId: text("plaid_item_id"),
});
```

- [ ] **Step 2: Add `plaidTransactionId` to `transactions` table**

Find the `transactions` table definition. Add one column after `createdAt`:

```typescript
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    date: date("date", { mode: "date" }).notNull(),
    description: text("description").notNull(),
    category: categoryEnum("category").notNull().default("Other"),
    source: transactionSourceEnum("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    plaidTransactionId: text("plaid_transaction_id").unique(), // null for non-Plaid transactions
  },
  (table) => ({
    userDateIdx: index("transactions_user_date_idx").on(table.userId, table.date),
  })
);
```

- [ ] **Step 3: Generate and apply migration**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
npm run db:generate
npm run db:migrate
```

Expected output: migration applied successfully with 4 new columns.

- [ ] **Step 4: Commit**

```bash
git add src/lib/schema.ts drizzle/
git commit -m "feat: add plaid columns to accounts and transactions schema"
```

---

## Task 3: Create `src/lib/plaid.ts`

**Files:**
- Create: `src/lib/plaid.ts`
- Create: `src/lib/__tests__/plaid.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/lib/__tests__/plaid.test.ts`:

```typescript
import {
  encryptToken,
  decryptToken,
  mapPlaidCategory,
  mapPlaidAccountType,
} from "../plaid";

describe("encryptToken / decryptToken", () => {
  beforeAll(() => {
    process.env.PLAID_ENCRYPTION_KEY = "a".repeat(64); // 32 bytes as hex
  });

  it("roundtrips a token correctly", () => {
    const token = "access-sandbox-abc123";
    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it("produces different ciphertexts each call (random IV)", () => {
    const token = "access-sandbox-abc123";
    expect(encryptToken(token)).not.toBe(encryptToken(token));
  });
});

describe("mapPlaidCategory", () => {
  it("maps Food and Drink to Food", () => {
    expect(mapPlaidCategory(["Food and Drink", "Restaurants"])).toBe("Food");
  });

  it("maps Travel to Transport", () => {
    expect(mapPlaidCategory(["Travel", "Airlines and Aviation Services"])).toBe("Transport");
  });

  it("maps Healthcare to Health", () => {
    expect(mapPlaidCategory(["Healthcare", "Pharmacies"])).toBe("Health");
  });

  it("maps Recreation to Entertainment", () => {
    expect(mapPlaidCategory(["Recreation", "Gyms and Fitness Centers"])).toBe("Entertainment");
  });

  it("maps Shops to Shopping", () => {
    expect(mapPlaidCategory(["Shops", "Department Stores"])).toBe("Shopping");
  });

  it("maps Transfer/Deposit to Income", () => {
    expect(mapPlaidCategory(["Transfer", "Payroll"])).toBe("Income");
  });

  it("falls back to Other for unknown", () => {
    expect(mapPlaidCategory(["Service", "Financial"])).toBe("Other");
  });

  it("handles null category", () => {
    expect(mapPlaidCategory(null)).toBe("Other");
  });
});

describe("mapPlaidAccountType", () => {
  it("maps depository/checking to checking", () => {
    expect(mapPlaidAccountType("depository", "checking")).toBe("checking");
  });

  it("maps depository/savings to savings", () => {
    expect(mapPlaidAccountType("depository", "savings")).toBe("savings");
  });

  it("maps credit to credit", () => {
    expect(mapPlaidAccountType("credit", "credit card")).toBe("credit");
  });

  it("maps investment to investment", () => {
    expect(mapPlaidAccountType("investment", null)).toBe("investment");
  });

  it("maps loan to loan", () => {
    expect(mapPlaidAccountType("loan", "mortgage")).toBe("loan");
  });

  it("defaults unknown types to checking", () => {
    expect(mapPlaidAccountType("other", null)).toBe("checking");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
npm test -- --testPathPattern="plaid.test" 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../plaid'`

- [ ] **Step 3: Create `src/lib/plaid.ts`**

```typescript
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from "plaid";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { accounts, transactions } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import type { AccountType } from "@/lib/account-types";
import type { TransactionCategory } from "@/lib/categories";

// ── Plaid SDK client ─────────────────────────────────────────────────────────

const config = new Configuration({
  basePath:
    PlaidEnvironments[
      (process.env.PLAID_ENV ?? "sandbox") as keyof typeof PlaidEnvironments
    ],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(config);

// ── Token encryption (AES-256-CBC) ───────────────────────────────────────────

const ALGORITHM = "aes-256-cbc";

function getKey(): Buffer {
  const hex = process.env.PLAID_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("PLAID_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptToken(token: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptToken(encrypted: string): string {
  const [ivHex, dataHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// ── Category + account type mapping ─────────────────────────────────────────

export function mapPlaidCategory(plaidCategory: string[] | null): TransactionCategory {
  const primary = (plaidCategory?.[0] ?? "").toLowerCase();
  if (primary.includes("food") || primary.includes("restaurant") || primary.includes("dining")) return "Food";
  if (primary.includes("travel") || primary.includes("transport") || primary.includes("taxi") || primary.includes("airline")) return "Transport";
  if (primary.includes("health") || primary.includes("medical") || primary.includes("pharma")) return "Health";
  if (primary.includes("recreation") || primary.includes("entertainment") || primary.includes("gym")) return "Entertainment";
  if (primary.includes("shop")) return "Shopping";
  if (primary.includes("transfer") || primary.includes("deposit") || primary.includes("payroll") || primary.includes("income")) return "Income";
  return "Other";
}

export function mapPlaidAccountType(type: string, subtype: string | null): AccountType {
  if (type === "depository") return subtype === "savings" ? "savings" : "checking";
  if (type === "credit") return "credit";
  if (type === "investment") return "investment";
  if (type === "loan") return "loan";
  return "checking";
}

// ── syncPlaidItem ─────────────────────────────────────────────────────────────
// Fetches latest accounts + up to 90 days of transactions from Plaid,
// upserts accounts (balance update) and transactions (skip duplicates).

export async function syncPlaidItem(userId: string, accessToken: string): Promise<void> {
  // 1. Sync account balances
  const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
  for (const pa of accountsResponse.data.accounts) {
    const balance = (pa.balances.current ?? 0).toFixed(2);
    await db
      .update(accounts)
      .set({ balance, lastUpdated: new Date() })
      .where(
        and(eq(accounts.plaidAccountId, pa.account_id), eq(accounts.userId, userId))
      );
  }

  // 2. Sync transactions (last 90 days, paginated)
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const allTxs: Awaited<ReturnType<typeof plaidClient.transactionsGet>>["data"]["transactions"] = [];
  let offset = 0;
  let totalTransactions = Infinity;

  while (allTxs.length < totalTransactions) {
    const res = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { offset, count: 500 },
    });
    allTxs.push(...res.data.transactions);
    totalTransactions = res.data.total_transactions;
    offset += res.data.transactions.length;
    if (res.data.transactions.length === 0) break;
  }

  // 3. Upsert each transaction
  for (const tx of allTxs) {
    // Find internal account id
    const [acct] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(eq(accounts.plaidAccountId, tx.account_id), eq(accounts.userId, userId))
      )
      .limit(1);

    if (!acct) continue;

    // Plaid: positive = debit (expense), negative = credit (income)
    // Our system: negative = expense, positive = income → negate
    const amount = (-tx.amount).toFixed(2);
    const category = mapPlaidCategory(tx.category ?? null);

    await db
      .insert(transactions)
      .values({
        userId,
        accountId: acct.id,
        amount,
        date: new Date(tx.date),
        description: tx.name,
        category,
        source: "plaid",
        plaidTransactionId: tx.transaction_id,
      })
      .onConflictDoNothing({ target: transactions.plaidTransactionId });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="plaid.test" 2>&1 | tail -15
```

Expected: PASS — 11 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plaid.ts src/lib/__tests__/plaid.test.ts
git commit -m "feat: add plaid lib with client, encrypt/decrypt, sync helpers"
```

---

## Task 4: Create `POST /api/plaid/create-link-token`

**Files:**
- Create: `src/app/api/plaid/create-link-token/route.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal/src/app/api/plaid/create-link-token"
```

- [ ] **Step 2: Create `src/app/api/plaid/create-link-token/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { plaidClient } from "@/lib/plaid";
import { CountryCode, Products } from "plaid";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: session.user.id },
      client_name: "MoneyPlan",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return Response.json({ linkToken: response.data.link_token });
  } catch (err) {
    console.error("Plaid create-link-token error:", err);
    return new Response(JSON.stringify({ error: "Could not create link token" }), { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
git add "src/app/api/plaid/create-link-token/"
git commit -m "feat: add POST /api/plaid/create-link-token"
```

---

## Task 5: Create `POST /api/plaid/exchange-token`

**Files:**
- Create: `src/app/api/plaid/exchange-token/route.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal/src/app/api/plaid/exchange-token"
```

- [ ] **Step 2: Create `src/app/api/plaid/exchange-token/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { plaidClient, encryptToken, mapPlaidAccountType, syncPlaidItem } from "@/lib/plaid";
import { db } from "@/lib/db";
import { accounts } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let body: { publicToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const publicToken = body.publicToken;
  if (typeof publicToken !== "string" || !publicToken) {
    return new Response(JSON.stringify({ error: "publicToken is required" }), { status: 400 });
  }

  try {
    // Exchange public token for permanent access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;
    const encryptedToken = encryptToken(accessToken);

    // Fetch accounts from Plaid
    const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });

    for (const pa of accountsResponse.data.accounts) {
      const type = mapPlaidAccountType(pa.type, pa.subtype ?? null);
      const balance = (pa.balances.current ?? 0).toFixed(2);

      // Upsert: update if already connected, insert if new
      const existing = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.plaidAccountId, pa.account_id))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(accounts)
          .set({ balance, lastUpdated: new Date() })
          .where(eq(accounts.plaidAccountId, pa.account_id));
      } else {
        await db.insert(accounts).values({
          userId: session.user.id,
          name: pa.name,
          type,
          balance,
          currency: "USD",
          plaidAccountId: pa.account_id,
          plaidAccessToken: encryptedToken,
          plaidItemId: itemId,
        });
      }
    }

    // Run initial transaction sync (last 90 days)
    await syncPlaidItem(session.user.id, accessToken);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Plaid exchange-token error:", err);
    return new Response(JSON.stringify({ error: "Could not connect bank account" }), { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
git add "src/app/api/plaid/exchange-token/"
git commit -m "feat: add POST /api/plaid/exchange-token"
```

---

## Task 6: Create `POST /api/plaid/sync`

**Files:**
- Create: `src/app/api/plaid/sync/route.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal/src/app/api/plaid/sync"
```

- [ ] **Step 2: Create `src/app/api/plaid/sync/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { decryptToken, syncPlaidItem } from "@/lib/plaid";
import { db } from "@/lib/db";
import { accounts } from "@/lib/schema";
import { and, eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let body: { plaidItemId?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const plaidItemId = body.plaidItemId;
  if (typeof plaidItemId !== "string" || !plaidItemId) {
    return new Response(JSON.stringify({ error: "plaidItemId is required" }), { status: 400 });
  }

  // Find any account with this itemId belonging to the current user
  const [account] = await db
    .select({ plaidAccessToken: accounts.plaidAccessToken })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, session.user.id),
        eq(accounts.plaidItemId, plaidItemId)
      )
    )
    .limit(1);

  if (!account?.plaidAccessToken) {
    return new Response(JSON.stringify({ error: "Plaid account not found" }), { status: 404 });
  }

  try {
    const accessToken = decryptToken(account.plaidAccessToken);
    await syncPlaidItem(session.user.id, accessToken);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Plaid sync error:", err);
    return new Response(JSON.stringify({ error: "Sync failed. Please try again." }), { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
git add "src/app/api/plaid/sync/"
git commit -m "feat: add POST /api/plaid/sync"
```

---

## Task 7: Create `<PlaidConnectButton />` component

**Files:**
- Create: `src/components/net-worth/plaid-connect-button.tsx`

- [ ] **Step 1: Create `src/components/net-worth/plaid-connect-button.tsx`**

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { Building2, Loader2 } from "lucide-react";

export function PlaidConnectButton({ onSuccess }: { onSuccess: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(false);
  const [error, setError] = useState("");

  // Fetch link token on mount
  useEffect(() => {
    fetch("/api/plaid/create-link-token", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.linkToken) setLinkToken(data.linkToken);
        else setError("Could not initialise bank connection.");
      })
      .catch(() => setError("Could not initialise bank connection."));
  }, []);

  const onPlaidSuccess = useCallback(
    async (publicToken: string) => {
      setExchanging(true);
      setError("");
      try {
        const res = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicToken }),
        });
        if (!res.ok) throw new Error();
        onSuccess();
      } catch {
        setError("Could not connect bank. Please try again.");
      } finally {
        setExchanging(false);
      }
    },
    [onSuccess]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: (public_token) => onPlaidSuccess(public_token),
    onExit: () => {},
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={() => open()}
        disabled={!ready || exchanging}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        {exchanging ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Building2 className="h-3.5 w-3.5" />
        )}
        {exchanging ? "Connecting..." : "Connect Bank"}
      </Button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
git add src/components/net-worth/plaid-connect-button.tsx
git commit -m "feat: add PlaidConnectButton component with Plaid Link integration"
```

---

## Task 8: Modify `accounts-list.tsx` — Plaid badge + Sync Now

**Files:**
- Modify: `src/components/net-worth/accounts-list.tsx`

- [ ] **Step 1: Replace the full content of `src/components/net-worth/accounts-list.tsx`**

Read the file first, then replace with:

```typescript
"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountFormDialog } from "./account-form-dialog";
import { ACCOUNT_TYPE_LABELS, LIABILITY_TYPES, AccountType, calcNetWorth } from "@/lib/account-types";
import { useRouter } from "next/navigation";

type Account = {
  id: string;
  name: string;
  type: AccountType;
  balance: string;
  plaidAccountId: string | null;
  plaidItemId: string | null;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function AccountsList({ initialAccounts }: { initialAccounts: Account[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string>("");
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("Delete this account?")) return;
    await fetch("/api/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    router.refresh();
  }

  function handleSaved(account: Account) {
    setAccounts((prev) =>
      editing
        ? prev.map((a) => (a.id === account.id ? account : a))
        : [...prev, account]
    );
    setEditing(null);
    router.refresh();
  }

  async function handleSync(plaidItemId: string) {
    setSyncingItemId(plaidItemId);
    setSyncError("");
    try {
      const res = await fetch("/api/plaid/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plaidItemId }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setSyncError("Sync failed. Please try again.");
    } finally {
      setSyncingItemId(null);
    }
  }

  const assets = accounts.filter((a) => !LIABILITY_TYPES.includes(a.type));
  const liabilities = accounts.filter((a) => LIABILITY_TYPES.includes(a.type));

  function AccountGroup({ title, items, color }: { title: string; items: Account[]; color: string }) {
    return (
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{title}</h3>
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-2">None added yet</p>
        ) : (
          <div className="space-y-2">
            {items.map((a) => {
              const bal = parseFloat(a.balance);
              const isPlaid = !!a.plaidAccountId;
              const isSyncing = syncingItemId === a.plaidItemId;

              return (
                <div key={a.id} className="flex items-center justify-between rounded-lg border bg-white px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{a.name}</p>
                      {isPlaid && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                          🏦 Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{ACCOUNT_TYPE_LABELS[a.type]}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold tabular-nums ${color}`}>
                      {fmt(Math.abs(bal))}
                    </span>
                    <div className="flex gap-1">
                      {isPlaid ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => a.plaidItemId && handleSync(a.plaidItemId)}
                          disabled={isSyncing}
                          className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-800 gap-1"
                        >
                          {isSyncing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          {isSyncing ? "Syncing..." : "Sync Now"}
                        </Button>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setEditing(a)} className="h-7 w-7 p-0">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const { netWorth, totalAssets, totalLiabilities } = calcNetWorth(accounts);

  return (
    <div className="rounded-xl border bg-slate-50 p-5 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Accounts & Assets</h2>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" />
          Add Account
        </Button>
      </div>

      {syncError && (
        <p className="text-xs text-red-500">{syncError}</p>
      )}

      <AccountGroup title="Assets" items={assets} color="text-slate-900" />
      <AccountGroup title="Liabilities" items={liabilities} color="text-red-600" />

      <AccountFormDialog
        open={addOpen || !!editing}
        onOpenChange={(o) => { if (!o) { setAddOpen(false); setEditing(null); } }}
        onSaved={handleSaved}
        initial={editing}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
git add src/components/net-worth/accounts-list.tsx
git commit -m "feat: add Plaid badge and Sync Now button to accounts list"
```

---

## Task 9: Update Net Worth page + `listAccounts`

**Files:**
- Modify: `src/lib/accounts.ts` — include plaid columns in `listAccounts` return
- Modify: `src/app/(app)/net-worth/page.tsx` — add PlaidConnectButton, pass plaid fields

- [ ] **Step 1: Verify `listAccounts` returns plaid columns**

Read `src/lib/accounts.ts`. The `listAccounts` function uses `db.select().from(accounts)` — Drizzle returns all columns by default so `plaidAccountId` and `plaidItemId` are already included. No change needed to `accounts.ts`.

- [ ] **Step 2: Replace `src/app/(app)/net-worth/page.tsx`**

Read the file first, then replace with:

```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listAccounts, listSnapshots } from "@/lib/accounts";
import { calcNetWorth } from "@/lib/account-types";
import { NetWorthSummary } from "@/components/net-worth/net-worth-summary";
import { NetWorthChart } from "@/components/net-worth/net-worth-chart";
import { AccountsList } from "@/components/net-worth/accounts-list";
import { PlaidConnectButton } from "@/components/net-worth/plaid-connect-button";

export default async function NetWorthPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const [accountList, snapshots] = await Promise.all([
    listAccounts(session.user.id),
    listSnapshots(session.user.id, 12),
  ]);

  const { totalAssets, totalLiabilities, netWorth } = calcNetWorth(accountList);
  const sortedSnapshots = [...snapshots].reverse(); // oldest → newest

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Net Worth</h1>
          <p className="text-sm text-slate-500 mt-1">Track all your assets and liabilities</p>
        </div>
        <PlaidConnectButton onSuccess={() => {}} />
      </div>

      <NetWorthSummary
        totalAssets={totalAssets}
        totalLiabilities={totalLiabilities}
        netWorth={netWorth}
      />

      <NetWorthChart snapshots={sortedSnapshots} />

      <AccountsList initialAccounts={accountList} />
    </div>
  );
}
```

Note: `PlaidConnectButton` is a client component — its `onSuccess` triggers a page refresh internally via `router.refresh()` (already wired in the component). The server page's `onSuccess` prop is intentionally a no-op `() => {}` because the client component handles refresh itself.

- [ ] **Step 3: Fix the `calcNetWorth` import in net-worth page**

The page now imports `calcNetWorth` from `@/lib/account-types` (not `@/lib/accounts`) to avoid the server component importing the wrong source. The import above is already correct.

Also update `src/lib/accounts.ts` to remove the now-redundant re-export of `calcNetWorth` if it was added there — or leave it since it's a harmless re-export. No change needed.

- [ ] **Step 4: Commit**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
git add "src/app/(app)/net-worth/page.tsx"
git commit -m "feat: add PlaidConnectButton to Net Worth page"
```

---

## Task 10: Run all tests + push to GitHub

- [ ] **Step 1: Run full test suite**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
npm test 2>&1 | tail -15
```

Expected: All tests passing (original 11 + new Plaid tests).

- [ ] **Step 2: Smoke-test manually in the browser**

Start the dev server:
```bash
npm run dev
```

1. Open http://localhost:3000/net-worth
2. Click "Connect Bank"
3. In Plaid Link sandbox, search for **"Plaid Test Bank"** and use:
   - Username: `user_good`
   - Password: `pass_good`
4. Select any account → click Continue
5. Confirm the account appears in the list with "🏦 Connected" badge
6. Click "Sync Now" → spinner → balances update

- [ ] **Step 3: Update roadmap**

In `docs/superpowers/specs/roadmap.md`, update the table to add Plaid:

```markdown
| Phase | Feature | Status |
|---|---|---|
| 1 | Budget Setup Agent | ✅ Complete |
| 1.5 | Plaid Bank Connection | ✅ Complete |
| 2 | Tool-Calling AI Chat | 📋 Planned |
| 3 | Proactive Smart Alerts | 📋 Planned |
| 4 | Financial Goals Agent | 📋 Planned |
```

- [ ] **Step 4: Push to GitHub**

```bash
cd "/Users/kashyapshukla/personal projects/moneyplan/.claude/worktrees/lucid-pascal"
git add docs/superpowers/specs/roadmap.md
git commit -m "docs: mark Plaid integration complete in roadmap"
git push origin claude/lucid-pascal
git push origin claude/lucid-pascal:main --force-with-lease
```

---

## Self-Review

**Spec coverage:**
- ✅ Plaid Link flow (create-link-token → exchange-token) — Tasks 4, 5, 7
- ✅ `access_token` encrypted at rest (AES-256-CBC) — Task 3
- ✅ "Sync Now" button calls `/api/plaid/sync` — Tasks 6, 8
- ✅ Plaid accounts upserted into existing `accounts` table — Task 5
- ✅ Plaid transactions upserted with deduplication via `plaidTransactionId` — Tasks 2, 3
- ✅ Plaid accounts are read-only (no edit button) — Task 8
- ✅ 🏦 Connected badge on Plaid accounts — Task 8
- ✅ Sandbox credentials in `.env.local` — Task 1
- ✅ Sandbox → Production via `PLAID_ENV` env var — Tasks 1, 3
- ✅ Schema additions with nullable Plaid columns — Task 2
- ✅ Amount sign conversion (Plaid positive→debit, our system negative→expense) — Task 3
- ✅ Plaid category mapping to our `TransactionCategory` — Task 3
- ✅ Plaid account type mapping to our `AccountType` — Task 3
- ✅ Pagination for transaction fetch (>500 transactions) — Task 3

**Type consistency:**
- `syncPlaidItem(userId: string, accessToken: string)` defined Task 3, used in Tasks 5 and 6 ✅
- `encryptToken` / `decryptToken` defined Task 3, used in Tasks 5 and 6 ✅
- `Account` type in `accounts-list.tsx` includes `plaidAccountId: string | null`, `plaidItemId: string | null` — matches what `listAccounts` returns (Drizzle selects all columns) ✅
- `PlaidConnectButton` prop `onSuccess: () => void` — matches usage in net-worth page ✅
