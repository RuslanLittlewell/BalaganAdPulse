-- AlterEnum
ALTER TYPE "kpi_metric" ADD VALUE 'RESULTS';
ALTER TYPE "kpi_metric" ADD VALUE 'COST_PER_RESULT';

-- AlterEnum
ALTER TYPE "summary_tile" ADD VALUE 'RESULTS';

-- AlterTable
ALTER TABLE "campaign_daily_metric" ADD COLUMN "results" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ad_set_daily_metric" ADD COLUMN "results" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ad_daily_metric" ADD COLUMN "results" INTEGER NOT NULL DEFAULT 0;
