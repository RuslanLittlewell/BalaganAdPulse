CREATE TYPE "lead_origin" AS ENUM ('MANUAL', 'META');

ALTER TABLE "lead" ADD COLUMN "origin" "lead_origin" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "lead" ADD COLUMN "ad_id" TEXT;

CREATE INDEX "lead_ad_id_idx" ON "lead"("ad_id");

ALTER TABLE "lead" ADD CONSTRAINT "lead_ad_id_fkey"
  FOREIGN KEY ("ad_id") REFERENCES "ad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "lead_meta_source" (
  "lead_id" TEXT PRIMARY KEY REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "account_id" TEXT NOT NULL,
  "form_id" TEXT NOT NULL,
  "campaign_external_id" TEXT NOT NULL,
  "campaign_name" TEXT NOT NULL,
  "ad_set_external_id" TEXT NOT NULL,
  "ad_set_name" TEXT NOT NULL,
  "ad_external_id" TEXT NOT NULL,
  "ad_name" TEXT NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL,
  "answers" JSONB NOT NULL,
  "answers_omitted" BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE "meta_lead" (
  "org_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "external_id" TEXT NOT NULL,
  "lead_id" TEXT REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("org_id", "external_id")
);

CREATE UNIQUE INDEX "meta_lead_lead_id_key" ON "meta_lead"("lead_id");
