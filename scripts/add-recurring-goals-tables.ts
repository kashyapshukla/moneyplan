import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
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

  await sql`DO $$ BEGIN
    CREATE TYPE goal_type AS ENUM ('savings','debt_payoff','emergency_fund');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;

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
      linked_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
      target_months INTEGER,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `;
  console.log("goals created");

  await sql`CREATE INDEX IF NOT EXISTS goals_user_id_idx ON goals(user_id)`;
  console.log("goals index created");
}

main().catch(console.error);
