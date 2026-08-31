-- A client is a company; a project is the work done for it. Niche, budget and
-- the logo describe the work, so they move to the new table, and the sheets
-- re-parent from the client onto the project.

CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "niche" TEXT,
    "monthly_budget" DECIMAL(12,2),
    "image" TEXT,
    "avatar_path" TEXT,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_client_id_position_idx" ON "project"("client_id", "position");

ALTER TABLE "project" ADD CONSTRAINT "project_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every existing client becomes one project carrying what it used to describe.
-- The project reuses the client's id, which is what lets the campaigns below be
-- re-pointed without a lookup table.
INSERT INTO "project" ("id", "client_id", "name", "niche", "monthly_budget", "image", "avatar_path", "position", "created_at", "updated_at")
SELECT "id", "id", "name", "niche", "monthly_budget", "image", "avatar_path", 0, "created_at", "updated_at"
FROM "client";

ALTER TABLE "campaign" ADD COLUMN "project_id" TEXT;
UPDATE "campaign" SET "project_id" = "client_id";
ALTER TABLE "campaign" ALTER COLUMN "project_id" SET NOT NULL;

ALTER TABLE "campaign" DROP CONSTRAINT "campaign_client_id_fkey";
DROP INDEX "campaign_client_id_position_idx";
ALTER TABLE "campaign" DROP COLUMN "client_id";

ALTER TABLE "campaign" ADD CONSTRAINT "campaign_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "campaign_project_id_position_idx" ON "campaign"("project_id", "position");

ALTER TABLE "client" DROP COLUMN "niche";
ALTER TABLE "client" DROP COLUMN "monthly_budget";
