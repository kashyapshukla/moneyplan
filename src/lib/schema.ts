import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  pgEnum,
  uuid,
  date,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const accountTypeEnum = pgEnum("account_type", [
  "checking",
  "savings",
  "credit",
  "investment",
  "crypto",
  "real_estate",
  "loan",
  "retirement",
  "vehicle",
]);

export const categoryEnum = pgEnum("category", [
  "Food",
  "Housing",
  "Transport",
  "Health",
  "Entertainment",
  "Shopping",
  "Income",
  "Investment",
  "Savings",
  "Other",
]);

export const transactionSourceEnum = pgEnum("transaction_source", [
  "csv_upload",
  "plaid",
  "manual",
]);

// Required by NextAuth Drizzle Adapter
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"), // for email/password provider
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

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

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: categoryEnum("category").notNull(),
    monthlyLimit: numeric("monthly_limit", { precision: 12, scale: 2 }).notNull(),
    month: integer("month").notNull(), // 1–12
    year: integer("year").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userCategoryMonthYear: uniqueIndex("budgets_user_category_month_year_idx").on(
      table.userId, table.category, table.month, table.year
    ),
  })
);

export const netWorthSnapshots = pgTable(
  "net_worth_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    totalAssets: numeric("total_assets", { precision: 14, scale: 2 }).notNull(),
    totalLiabilities: numeric("total_liabilities", { precision: 14, scale: 2 }).notNull(),
    // Denormalized for read performance: always equals totalAssets - totalLiabilities.
    // Application layer is responsible for keeping this consistent on write.
    netWorth: numeric("net_worth", { precision: 14, scale: 2 }).notNull(),
    snapshotDate: date("snapshot_date", { mode: "date" }).notNull(),
  },
  (table) => ({
    userDateIdx: index("net_worth_snapshots_user_date_idx").on(table.userId, table.snapshotDate),
  })
);

// NextAuth required tables (Drizzle Adapter)
export const authAccounts = pgTable(
  "auth_accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.provider, table.providerAccountId] }),
  })
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.identifier, table.token] }),
  })
);
