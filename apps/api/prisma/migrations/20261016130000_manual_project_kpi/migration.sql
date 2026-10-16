-- AlterEnum
ALTER TYPE "kpi_metric" ADD VALUE 'MANUAL';

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "kpi_name" TEXT,
ADD COLUMN     "kpi_value" DECIMAL(18,4);

-- AddCheckConstraint
ALTER TABLE "project" ADD CONSTRAINT "project_kpi_manual_complete" CHECK (COALESCE("kpi_metric"::text = 'MANUAL', false) = ("kpi_name" IS NOT NULL) AND ("kpi_name" IS NULL) = ("kpi_value" IS NULL));
ALTER TABLE "organization" ADD CONSTRAINT "organization_kpi_not_manual" CHECK ("kpi_metric" IS NULL OR "kpi_metric"::text <> 'MANUAL');
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_kpi_not_manual" CHECK ("kpi_metric" IS NULL OR "kpi_metric"::text <> 'MANUAL');
