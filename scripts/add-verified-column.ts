/**
 * Run once to add the `verified` column to the transactions table.
 * Usage:  npx tsx scripts/add-verified-column.ts
 */
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS verified TEXT NOT NULL DEFAULT 'false'
  `;
  console.log("✅  'verified' column added to transactions");
}

main().catch((e) => { console.error(e); process.exit(1); });
