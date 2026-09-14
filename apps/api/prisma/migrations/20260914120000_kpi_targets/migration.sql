CREATE TYPE "kpi_metric" AS ENUM ('SPEND', 'IMPRESSIONS', 'REACH', 'CLICKS', 'CONVERSIONS', 'REVENUE', 'CTR', 'CPC', 'CPM', 'CPA', 'ROAS', 'FREQUENCY');

ALTER TABLE "organization" ADD COLUMN "kpi_metric" "kpi_metric";
ALTER TABLE "organization" ADD COLUMN "kpi_target" DECIMAL(18,4);
ALTER TABLE "organization" ADD COLUMN "kpi_updated_at" TIMESTAMP(3);
ALTER TABLE "organization" ADD CONSTRAINT "organization_kpi_complete" CHECK (("kpi_metric" IS NULL) = ("kpi_target" IS NULL));

ALTER TABLE "project" ADD COLUMN "kpi_metric" "kpi_metric";
ALTER TABLE "project" ADD COLUMN "kpi_target" DECIMAL(18,4);
ALTER TABLE "project" ADD COLUMN "kpi_updated_at" TIMESTAMP(3);
ALTER TABLE "project" ADD CONSTRAINT "project_kpi_complete" CHECK (("kpi_metric" IS NULL) = ("kpi_target" IS NULL));

ALTER TABLE "campaign" ADD COLUMN "kpi_metric" "kpi_metric";
ALTER TABLE "campaign" ADD COLUMN "kpi_target" DECIMAL(18,4);
ALTER TABLE "campaign" ADD COLUMN "kpi_updated_at" TIMESTAMP(3);
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_kpi_complete" CHECK (("kpi_metric" IS NULL) = ("kpi_target" IS NULL));
