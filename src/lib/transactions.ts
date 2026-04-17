import { db } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { and, eq, gte, lte, like, desc, SQL } from "drizzle-orm";

// Re-export from the no-DB constants file so existing imports keep working
export type { TransactionCategory } from "@/lib/categories";
export { CATEGORY_LABELS } from "@/lib/categories";

export type TransactionSource = "csv_upload" | "plaid" | "manual";

export interface NewTransaction {
  userId: string;
  accountId?: string | null;
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
