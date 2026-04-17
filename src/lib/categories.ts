// Pure constants — no DB imports, safe to use in client components

export type TransactionCategory =
  | "Food" | "Housing" | "Transport" | "Health"
  | "Entertainment" | "Shopping" | "Income" | "Other";

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  Food: "Food & Dining",
  Housing: "Housing",
  Transport: "Transport",
  Health: "Health",
  Entertainment: "Entertainment",
  Shopping: "Shopping",
  Income: "Income",
  Other: "Other",
};
