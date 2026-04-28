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
