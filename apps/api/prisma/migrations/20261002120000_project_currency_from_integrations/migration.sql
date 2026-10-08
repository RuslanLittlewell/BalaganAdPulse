ALTER TABLE "project" ALTER COLUMN "budget_currency" DROP DEFAULT;
ALTER TABLE "project" ALTER COLUMN "budget_currency" DROP NOT NULL;
ALTER TABLE "project" ALTER COLUMN "budget_currency" TYPE VARCHAR(3) USING "budget_currency"::text;
ALTER TABLE "project" ADD CONSTRAINT "project_budget_currency_code" CHECK ("budget_currency" ~ '^[A-Z]{3}$');
DROP TYPE "currency";
