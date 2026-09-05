ALTER TABLE "lead" DROP COLUMN "telegram";

ALTER TABLE "lead" ADD COLUMN "project_id" TEXT;
ALTER TABLE "lead" ADD COLUMN "campaign_id" TEXT;

CREATE INDEX "lead_project_id_idx" ON "lead"("project_id");
CREATE INDEX "lead_campaign_id_idx" ON "lead"("campaign_id");

ALTER TABLE "lead" ADD CONSTRAINT "lead_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lead" ADD CONSTRAINT "lead_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
