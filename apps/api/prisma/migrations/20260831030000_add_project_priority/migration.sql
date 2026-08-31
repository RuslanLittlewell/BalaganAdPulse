-- Every project carries how much attention it needs. Existing ones become NEW,
-- which is also what a freshly created project gets.
CREATE TYPE "project_priority" AS ENUM ('CRITICAL', 'URGENT', 'WAITING', 'IDLE', 'NEW');

ALTER TABLE "project" ADD COLUMN "priority" "project_priority" NOT NULL DEFAULT 'NEW';
