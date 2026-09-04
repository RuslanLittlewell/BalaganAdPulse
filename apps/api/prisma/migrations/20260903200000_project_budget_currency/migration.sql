-- What a monthly budget is stated in. Never inferred: it is what the agency and
-- the client agreed, and only they know it.
CREATE TYPE "currency" AS ENUM ('BYN', 'RUB', 'USD', 'EUR');

-- NOT NULL with a default, so a project with no amount still has a currency and
-- entering one later is a one-field decision. Every existing project takes BYN,
-- which is what this agency's budgets were entered as.
ALTER TABLE "project"
  ADD COLUMN "budget_currency" "currency" NOT NULL DEFAULT 'BYN';
