/**
 * Run once to add 'Transfer' to the category enum in Postgres.
 * ALTER TYPE cannot run inside a transaction, so Drizzle migrations won't work.
 *
 * Usage:
 *   npx tsx scripts/add-transfer-category.ts
 */
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`ALTER TYPE category ADD VALUE IF NOT EXISTS 'Transfer'`;
  console.log("✅ 'Transfer' added to category enum");
}

main().catch((e) => { console.error(e); process.exit(1); });
