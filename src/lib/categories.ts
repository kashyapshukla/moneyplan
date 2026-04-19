// Pure constants — no DB imports, safe to use in client components

export type TransactionCategory =
  | "Food" | "Housing" | "Transport" | "Health"
  | "Entertainment" | "Shopping" | "Income"
  | "Investment" | "Savings" | "Transfer" | "Other";

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  Food: "Food & Dining",
  Housing: "Housing",
  Transport: "Transport",
  Health: "Health",
  Entertainment: "Entertainment",
  Shopping: "Shopping",
  Income: "Income",
  Investment: "Investment",
  Savings: "Savings",
  Transfer: "Transfer",
  Other: "Other",
};

// Categories that are never counted as expenses or income
export const NON_EXPENSE_CATEGORIES: TransactionCategory[] = ["Income", "Transfer"];
