-- ALTER TYPE cannot run inside a transaction in Postgres.
-- Run this file directly against your Neon database.
ALTER TYPE "category" ADD VALUE IF NOT EXISTS 'Transfer';
