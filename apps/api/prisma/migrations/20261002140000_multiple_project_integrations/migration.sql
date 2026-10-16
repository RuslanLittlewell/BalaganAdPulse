ALTER TABLE "project_integration" ADD COLUMN "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE "project_integration" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "project_integration" DROP CONSTRAINT "project_integration_pkey";
ALTER TABLE "project_integration" ADD CONSTRAINT "project_integration_pkey" PRIMARY KEY ("id");
ALTER TABLE "project_integration" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'META';
ALTER TABLE "project_integration" ADD COLUMN "leads_enabled" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "project_integration_project_id_account_id_key" ON "project_integration"("project_id", "account_id");
CREATE INDEX "project_integration_project_id_idx" ON "project_integration"("project_id");

ALTER TABLE "campaign" ADD COLUMN "source_account_id" TEXT;
UPDATE "campaign" SET "source_account_id" = "project_integration"."account_id"
FROM "project_integration"
WHERE "campaign"."project_id" = "project_integration"."project_id"
  AND "campaign"."channel" = 'META'
  AND "campaign"."external_id" IS NOT NULL;
