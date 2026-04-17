ALTER TABLE "accounts" ADD COLUMN "plaid_account_id" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "plaid_access_token" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "plaid_item_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "plaid_transaction_id" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_plaid_account_id_unique" UNIQUE("plaid_account_id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_plaid_transaction_id_unique" UNIQUE("plaid_transaction_id");