# MoneyPlan Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully working Transactions page — CSV upload with auto column detection, Gemini auto-categorization, duplicate detection, manual add/edit/delete, and search/filter by category, date, and account.

**Architecture:** Two API routes (`/api/transactions` for CRUD, `/api/transactions/upload` for CSV). Client-side React components handle the UI. Gemini API called server-side on upload. All queries scoped to the authenticated user via session.

**Tech Stack:** Next.js 14 App Router, Drizzle ORM, Neon Postgres, Google Gemini API (`@google/generative-ai`), `papaparse` for CSV parsing, shadcn/ui components.

---

## File Map

| File | Responsibility |
|---|---|
| `src/lib/gemini.ts` | Gemini client singleton + `categorizeTransactions()` helper |
| `src/lib/transactions.ts` | DB query helpers: list, insert, update, delete, duplicate check |
| `src/app/api/transactions/route.ts` | GET (list with filters) + POST (manual add) + PATCH (edit) + DELETE |
| `src/app/api/transactions/upload/route.ts` | POST — parse CSV, detect columns, deduplicate, categorize, insert |
| `src/app/(app)/transactions/page.tsx` | Server component — fetches initial data, renders page shell |
| `src/components/transactions/transactions-table.tsx` | Client component — sortable table with edit/delete per row |
| `src/components/transactions/add-transaction-dialog.tsx` | Client component — modal form for manual add/edit |
| `src/components/transactions/csv-upload-dialog.tsx` | Client component — file picker, column mapper, import confirmation |
| `src/components/transactions/transaction-filters.tsx` | Client component — search input + category/date dropdowns |

---

## Task 1: Gemini Client

**Files:**
- Create: `src/lib/gemini.ts`
- Create: `src/lib/__tests__/gemini.test.ts`

- [ ] **Step 1: Install Gemini SDK**

```bash
npm install @google/generative-ai
```

Add to `.env.local`:
```
GEMINI_API_KEY=your-gemini-api-key
```

Add to `.env.example`:
```
GEMINI_API_KEY=your-gemini-api-key
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/__tests__/gemini.test.ts`:

```typescript
jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify([
              { index: 0, category: "Food" },
              { index: 1, category: "Transport" },
            ]),
        },
      }),
    }),
  })),
}));

import { categorizeTransactions } from "../gemini";

describe("categorizeTransactions", () => {
  it("returns a category for each transaction", async () => {
    const result = await categorizeTransactions([
      { description: "Starbucks coffee", amount: -5.5 },
      { description: "Uber ride", amount: -12.0 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe("Food");
    expect(result[1]).toBe("Transport");
  });

  it("falls back to Other if Gemini returns unexpected format", async () => {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    GoogleGenerativeAI.mockImplementationOnce(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
          response: { text: () => "not json" },
        }),
      }),
    }));

    const result = await categorizeTransactions([
      { description: "Mystery charge", amount: -9.99 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("Other");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest src/lib/__tests__/gemini.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../gemini'`

- [ ] **Step 4: Write the Gemini client**

Create `src/lib/gemini.ts`:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const VALID_CATEGORIES = [
  "Food", "Housing", "Transport", "Health",
  "Entertainment", "Shopping", "Income", "Other",
] as const;

type Category = (typeof VALID_CATEGORIES)[number];

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function categorizeTransactions(
  transactions: { description: string; amount: number }[]
): Promise<Category[]> {
  if (transactions.length === 0) return [];

  const prompt = `Categorize each transaction into exactly one of these categories:
Food, Housing, Transport, Health, Entertainment, Shopping, Income, Other.

Transactions:
${transactions.map((t, i) => `${i}. "${t.description}" amount: ${t.amount}`).join("\n")}

Reply ONLY with a JSON array like: [{"index": 0, "category": "Food"}, ...]
No explanation, no markdown, just the JSON array.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    // Strip markdown code blocks if present
    const clean = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const parsed: { index: number; category: string }[] = JSON.parse(clean);

    return transactions.map((_, i) => {
      const match = parsed.find((p) => p.index === i);
      const cat = match?.category as Category;
      return VALID_CATEGORIES.includes(cat) ? cat : "Other";
    });
  } catch {
    return transactions.map(() => "Other");
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest src/lib/__tests__/gemini.test.ts --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/gemini.ts src/lib/__tests__/gemini.test.ts .env.example
git commit -m "feat: add Gemini client with categorizeTransactions helper"
```

---

## Task 2: Transaction DB Helpers

**Files:**
- Create: `src/lib/transactions.ts`
- Create: `src/lib/__tests__/transactions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/transactions.test.ts`:

```typescript
jest.mock("@/lib/db", () => ({ db: {} }));
jest.mock("@neondatabase/serverless", () => ({ neon: jest.fn(() => jest.fn()) }));
jest.mock("drizzle-orm/neon-http", () => ({ drizzle: jest.fn(() => ({})) }));

import {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  checkDuplicate,
} from "../transactions";

describe("transactions module", () => {
  it("exports all required functions", () => {
    expect(typeof listTransactions).toBe("function");
    expect(typeof createTransaction).toBe("function");
    expect(typeof updateTransaction).toBe("function");
    expect(typeof deleteTransaction).toBe("function");
    expect(typeof checkDuplicate).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/lib/__tests__/transactions.test.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Write transaction helpers**

Create `src/lib/transactions.ts`:

```typescript
import { db } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { and, eq, gte, lte, like, desc, SQL } from "drizzle-orm";

export type TransactionCategory =
  | "Food" | "Housing" | "Transport" | "Health"
  | "Entertainment" | "Shopping" | "Income" | "Other";

export type TransactionSource = "csv_upload" | "plaid" | "manual";

export interface NewTransaction {
  userId: string;
  accountId?: string;
  amount: string;
  date: Date;
  description: string;
  category: TransactionCategory;
  source: TransactionSource;
}

export interface TransactionFilters {
  userId: string;
  category?: TransactionCategory;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export async function listTransactions(filters: TransactionFilters) {
  const conditions: SQL[] = [eq(transactions.userId, filters.userId)];

  if (filters.category) {
    conditions.push(eq(transactions.category, filters.category));
  }
  if (filters.dateFrom) {
    conditions.push(gte(transactions.date, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(transactions.date, filters.dateTo));
  }
  if (filters.search) {
    conditions.push(like(transactions.description, `%${filters.search}%`));
  }

  return db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date))
    .limit(500);
}

export async function createTransaction(data: NewTransaction) {
  const [tx] = await db
    .insert(transactions)
    .values({
      userId: data.userId,
      accountId: data.accountId ?? null,
      amount: data.amount,
      date: data.date,
      description: data.description,
      category: data.category,
      source: data.source,
    })
    .returning();
  return tx;
}

export async function updateTransaction(
  id: string,
  userId: string,
  data: Partial<Pick<NewTransaction, "amount" | "date" | "description" | "category">>
) {
  const [tx] = await db
    .update(transactions)
    .set(data)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning();
  return tx;
}

export async function deleteTransaction(id: string, userId: string) {
  await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

export async function checkDuplicate(
  userId: string,
  description: string,
  amount: string,
  date: Date
): Promise<boolean> {
  const existing = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.description, description),
        eq(transactions.amount, amount),
        eq(transactions.date, date)
      )
    )
    .limit(1);
  return existing.length > 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/lib/__tests__/transactions.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/transactions.ts src/lib/__tests__/transactions.test.ts
git commit -m "feat: add transaction DB helpers (list, create, update, delete, dedupe)"
```

---

## Task 3: Transactions API Routes

**Files:**
- Create: `src/app/api/transactions/route.ts`
- Create: `src/app/api/transactions/upload/route.ts`

- [ ] **Step 1: Install papaparse**

```bash
npm install papaparse
npm install --save-dev @types/papaparse
```

- [ ] **Step 2: Create the CRUD API route**

Create `src/app/api/transactions/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  TransactionCategory,
} from "@/lib/transactions";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const txs = await listTransactions({
    userId: session.user.id,
    category: searchParams.get("category") as TransactionCategory | undefined || undefined,
    search: searchParams.get("search") || undefined,
    dateFrom: searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!) : undefined,
    dateTo: searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!) : undefined,
  });
  return NextResponse.json(txs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const tx = await createTransaction({
    userId: session.user.id,
    amount: String(body.amount),
    date: new Date(body.date),
    description: body.description,
    category: body.category ?? "Other",
    source: "manual",
  });
  return NextResponse.json(tx, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...data } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const tx = await updateTransaction(id, session.user.id, {
    ...data,
    date: data.date ? new Date(data.date) : undefined,
    amount: data.amount !== undefined ? String(data.amount) : undefined,
  });
  return NextResponse.json(tx);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await deleteTransaction(id, session.user.id);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create the CSV upload API route**

Create `src/app/api/transactions/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Papa from "papaparse";
import { categorizeTransactions } from "@/lib/gemini";
import { checkDuplicate, createTransaction } from "@/lib/transactions";

// Auto-detect which CSV column is date / amount / description
function detectColumns(headers: string[]): {
  dateCol: string | null;
  amountCol: string | null;
  descCol: string | null;
} {
  const h = headers.map((h) => h.toLowerCase().trim());

  const dateCol = headers[h.findIndex((x) => x.includes("date"))] ?? null;
  const amountCol =
    headers[
      h.findIndex((x) => x.includes("amount") || x.includes("debit") || x.includes("credit"))
    ] ?? null;
  const descCol =
    headers[
      h.findIndex(
        (x) =>
          x.includes("description") ||
          x.includes("narration") ||
          x.includes("memo") ||
          x.includes("details") ||
          x.includes("particulars")
      )
    ] ?? null;

  return { dateCol, amountCol, descCol };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const text = await file.text();

  const { data, meta } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const headers = meta.fields ?? [];
  const { dateCol, amountCol, descCol } = detectColumns(headers);

  if (!dateCol || !amountCol || !descCol) {
    return NextResponse.json(
      {
        error: "Could not detect columns",
        detectedHeaders: headers,
        hint: "CSV needs columns for date, amount, and description",
      },
      { status: 422 }
    );
  }

  // Parse rows
  const rows = data
    .map((row) => ({
      date: new Date(row[dateCol]),
      amount: parseFloat(row[amountCol].replace(/[^0-9.-]/g, "")),
      description: row[descCol]?.trim() ?? "",
    }))
    .filter((r) => !isNaN(r.date.getTime()) && !isNaN(r.amount) && r.description.length > 0);

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid rows found in CSV" }, { status: 422 });
  }

  // Deduplicate against existing transactions
  const dupeChecks = await Promise.all(
    rows.map((r) =>
      checkDuplicate(session.user!.id!, r.description, String(r.amount), r.date)
    )
  );
  const newRows = rows.filter((_, i) => !dupeChecks[i]);
  const skipped = rows.length - newRows.length;

  if (newRows.length === 0) {
    return NextResponse.json({ imported: 0, skipped, message: "All rows already imported" });
  }

  // Categorize with Gemini
  const categories = await categorizeTransactions(
    newRows.map((r) => ({ description: r.description, amount: r.amount }))
  );

  // Insert
  const created = await Promise.all(
    newRows.map((row, i) =>
      createTransaction({
        userId: session.user!.id!,
        amount: String(row.amount),
        date: row.date,
        description: row.description,
        category: categories[i],
        source: "csv_upload",
      })
    )
  );

  return NextResponse.json({ imported: created.length, skipped });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/transactions/
git commit -m "feat: add transactions CRUD API and CSV upload with Gemini categorization"
```

---

## Task 4: Transactions UI Components

**Files:**
- Create: `src/components/transactions/transactions-table.tsx`
- Create: `src/components/transactions/add-transaction-dialog.tsx`
- Create: `src/components/transactions/csv-upload-dialog.tsx`
- Create: `src/components/transactions/transaction-filters.tsx`

- [ ] **Step 1: Install dialog and select shadcn components**

```bash
npx shadcn@latest add dialog select --overwrite -y 2>/dev/null || true
```

If shadcn CLI fails, create them manually (see below).

- [ ] **Step 2: Add the shadcn Dialog component**

Create `src/components/ui/dialog.tsx`:

```tsx
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%]",
        "rounded-lg border bg-white p-6 shadow-lg",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    >
      {children}
      <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogClose>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 pb-4", className)} {...props} />
);

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-slate-900", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose };
```

- [ ] **Step 3: Create the transaction filters component**

Create `src/components/transactions/transaction-filters.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Search } from "lucide-react";

const CATEGORIES = [
  "All", "Food", "Housing", "Transport", "Health",
  "Entertainment", "Shopping", "Income", "Other",
];

export function TransactionFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "All") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search transactions..."
          defaultValue={searchParams.get("search") ?? ""}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-400 w-64"
        />
      </div>

      <select
        value={searchParams.get("category") ?? "All"}
        onChange={(e) => updateFilter("category", e.target.value)}
        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <input
        type="date"
        defaultValue={searchParams.get("dateFrom") ?? ""}
        onChange={(e) => updateFilter("dateFrom", e.target.value)}
        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
      />
      <span className="self-center text-slate-400 text-sm">to</span>
      <input
        type="date"
        defaultValue={searchParams.get("dateTo") ?? ""}
        onChange={(e) => updateFilter("dateTo", e.target.value)}
        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
      />
    </div>
  );
}
```

- [ ] **Step 4: Create the transactions table**

Create `src/components/transactions/transactions-table.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddTransactionDialog } from "./add-transaction-dialog";

type Transaction = {
  id: string;
  date: Date | string;
  description: string;
  amount: string;
  category: string;
  source: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  Food: "bg-orange-100 text-orange-700",
  Housing: "bg-blue-100 text-blue-700",
  Transport: "bg-yellow-100 text-yellow-700",
  Health: "bg-green-100 text-green-700",
  Entertainment: "bg-purple-100 text-purple-700",
  Shopping: "bg-pink-100 text-pink-700",
  Income: "bg-emerald-100 text-emerald-700",
  Other: "bg-slate-100 text-slate-700",
};

export function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  const [data, setData] = useState(transactions);
  const [editing, setEditing] = useState<Transaction | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction?")) return;
    await fetch("/api/transactions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setData((prev) => prev.filter((t) => t.id !== id));
  }

  function handleSaved(updated: Transaction) {
    setData((prev) =>
      editing
        ? prev.map((t) => (t.id === updated.id ? updated : t))
        : [updated, ...prev]
    );
    setEditing(null);
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <p className="text-lg font-medium">No transactions yet</p>
        <p className="text-sm mt-1">Upload a CSV or add one manually</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((tx) => {
              const amount = parseFloat(tx.amount);
              const isIncome = amount > 0;
              return (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(tx.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 max-w-xs truncate">
                    {tx.description}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[tx.category] ?? CATEGORY_COLORS.Other}`}>
                      {tx.category}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-medium tabular-nums ${isIncome ? "text-emerald-600" : "text-slate-900"}`}>
                    {isIncome ? "+" : ""}${Math.abs(amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs capitalize">
                    {tx.source.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(tx)} className="h-7 w-7 p-0">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(tx.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <AddTransactionDialog
          open={!!editing}
          onOpenChange={(open) => { if (!open) setEditing(null); }}
          onSaved={handleSaved}
          initial={editing}
        />
      )}
    </>
  );
}
```

- [ ] **Step 5: Create the add/edit transaction dialog**

Create `src/components/transactions/add-transaction-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  "Food", "Housing", "Transport", "Health",
  "Entertainment", "Shopping", "Income", "Other",
];

type Transaction = {
  id?: string;
  date: Date | string;
  description: string;
  amount: string;
  category: string;
};

export function AddTransactionDialog({
  open,
  onOpenChange,
  onSaved,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (tx: any) => void;
  initial?: Transaction | null;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    date: initial?.date ? new Date(initial.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    description: initial?.description ?? "",
    amount: initial?.amount ?? "",
    category: initial?.category ?? "Other",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: initial?.id, ...form }),
      });
      const tx = await res.json();
      onSaved(tx);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Date</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Description</label>
            <input
              type="text"
              required
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Starbucks coffee"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Amount</label>
            <input
              type="number"
              required
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="e.g. -12.50 (negative = expense)"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : initial?.id ? "Save Changes" : "Add Transaction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Create the CSV upload dialog**

Create `src/components/transactions/csv-upload-dialog.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type UploadResult = { imported: number; skipped: number; message?: string };

export function CsvUploadDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setResult(null); setError(null); }
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/transactions/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
      } else {
        setResult(data);
        onImported();
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setFile(null);
    setResult(null);
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Upload a bank statement CSV. The app will auto-detect date, amount, and description columns and categorize each transaction using AI.
          </p>

          <div
            className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-8 cursor-pointer hover:border-slate-400 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            {file ? (
              <>
                <FileText className="h-8 w-8 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-500">Click to select a CSV file</p>
              </>
            )}
          </div>
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Imported {result.imported} transactions
              {result.skipped > 0 && `, skipped ${result.skipped} duplicates`}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              {result ? "Done" : "Cancel"}
            </Button>
            {!result && (
              <Button onClick={handleUpload} disabled={!file || loading}>
                {loading ? "Importing..." : "Import"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 7: Install Radix Dialog**

```bash
npm install @radix-ui/react-dialog
```

- [ ] **Step 8: Commit**

```bash
git add src/components/transactions/ src/components/ui/dialog.tsx
git commit -m "feat: add transactions UI - table, add/edit dialog, CSV upload dialog, filters"
```

---

## Task 5: Wire Up the Transactions Page

**Files:**
- Modify: `src/app/(app)/transactions/page.tsx`

- [ ] **Step 1: Update the transactions page**

Replace `src/app/(app)/transactions/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listTransactions, TransactionCategory } from "@/lib/transactions";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { CsvUploadDialog } from "@/components/transactions/csv-upload-dialog";
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { category?: string; search?: string; dateFrom?: string; dateTo?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const transactions = await listTransactions({
    userId: session.user.id,
    category: searchParams.category as TransactionCategory | undefined,
    search: searchParams.search,
    dateFrom: searchParams.dateFrom ? new Date(searchParams.dateFrom) : undefined,
    dateTo: searchParams.dateTo ? new Date(searchParams.dateTo) : undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500 mt-1">{transactions.length} transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvUploadDialog onImported={() => {}} />
          <AddTransactionDialog
            open={false}
            onOpenChange={() => {}}
            onSaved={() => {}}
          />
          <Button className="gap-2" onClick={() => {}}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      <Suspense>
        <TransactionFilters />
      </Suspense>

      <TransactionsTable transactions={transactions} />
    </div>
  );
}
```

> **Note:** The Add button and CsvUploadDialog need client-side state management for their open/close. In the next step we'll extract the action bar to a client component to handle this cleanly.

- [ ] **Step 2: Create a client action bar component**

Create `src/components/transactions/transactions-actions.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddTransactionDialog } from "./add-transaction-dialog";
import { CsvUploadDialog } from "./csv-upload-dialog";
import { useRouter } from "next/navigation";

export function TransactionsActions() {
  const [addOpen, setAddOpen] = useState(false);
  const router = useRouter();

  function handleSaved() {
    setAddOpen(false);
    router.refresh();
  }

  function handleImported() {
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <CsvUploadDialog onImported={handleImported} />
      <Button className="gap-2" onClick={() => setAddOpen(true)}>
        <Plus className="h-4 w-4" />
        Add
      </Button>
      <AddTransactionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={handleSaved}
      />
    </div>
  );
}
```

- [ ] **Step 3: Update transactions page to use action bar**

Replace `src/app/(app)/transactions/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listTransactions, TransactionCategory } from "@/lib/transactions";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { TransactionsActions } from "@/components/transactions/transactions-actions";
import { Suspense } from "react";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { category?: string; search?: string; dateFrom?: string; dateTo?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const transactions = await listTransactions({
    userId: session.user.id,
    category: searchParams.category as TransactionCategory | undefined,
    search: searchParams.search,
    dateFrom: searchParams.dateFrom ? new Date(searchParams.dateFrom) : undefined,
    dateTo: searchParams.dateTo ? new Date(searchParams.dateTo) : undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500 mt-1">{transactions.length} transactions</p>
        </div>
        <TransactionsActions />
      </div>

      <Suspense>
        <TransactionFilters />
      </Suspense>

      <TransactionsTable transactions={transactions} />
    </div>
  );
}
```

- [ ] **Step 4: Run all tests**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/transactions/ src/components/transactions/transactions-actions.tsx
git commit -m "feat: wire up transactions page with table, filters, add dialog, and CSV upload"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| CSV upload with auto column detection | Task 3 upload route + `detectColumns()` |
| Duplicate detection | `checkDuplicate()` in Task 2, called in Task 3 |
| Gemini auto-categorization on import | Task 1 `categorizeTransactions()`, called in Task 3 |
| Manual add/edit/delete | Task 3 CRUD route + Task 4 dialogs |
| Search by description | Task 2 `listTransactions` + Task 4 filters |
| Filter by category | Task 2 + Task 4 filters |
| Filter by date | Task 2 + Task 4 filters |
| All data scoped to user | Every query uses `userId` from session |
