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
  "Transfer",
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
    verified: text("verified").notNull().default("false"), // "true" | "false" — avoid bool migration issues
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

export const incomeSources = pgTable("income_sources", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  description: text("description").notNull(),
}, (t) => [uniqueIndex("income_sources_user_desc_idx").on(t.userId, t.description)]);

export const recurringTransactions = pgTable("recurring_transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  displayName: text("display_name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  category: categoryEnum("category").notNull().default("Other"),
  frequency: text("frequency").notNull(),
  dayOfMonth: integer("day_of_month"),
  lastSeen: date("last_seen", { mode: "date" }).notNull(),
  nextExpected: date("next_expected", { mode: "date" }),
  isSubscription: text("is_subscription").notNull().default("false"),
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [uniqueIndex("recurring_user_desc_idx").on(t.userId, t.description)]);

export const goalTypeEnum = pgEnum("goal_type", [
  "savings",
  "debt_payoff",
  "emergency_fund",
]);

export const goals = pgTable("goals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: goalTypeEnum("type").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }),
  currentAmount: numeric("current_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  monthlyContribution: numeric("monthly_contribution", { precision: 12, scale: 2 }),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).default("0"),
  targetDate: date("target_date", { mode: "date" }),
  linkedAccountId: uuid("linked_account_id").references(() => accounts.id, { onDelete: "set null" }),
  targetMonths: integer("target_months"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [index("goals_user_id_idx").on(t.userId)]);

export const holdings = pgTable("holdings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  plaidSecurityId: text("plaid_security_id"),
  ticker: text("ticker"),
  name: text("name").notNull(),
  securityType: text("security_type"),
  quantity: numeric("quantity", { precision: 16, scale: 6 }),
  price: numeric("price", { precision: 12, scale: 4 }),
  marketValue: numeric("market_value", { precision: 12, scale: 2 }).notNull(),
  costBasis: numeric("cost_basis", { precision: 12, scale: 2 }),
  lastSynced: timestamp("last_synced", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("holdings_user_id_idx").on(t.userId),
  uniqueIndex("holdings_user_security_idx").on(t.userId, t.plaidSecurityId),
]);
