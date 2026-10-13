-- CreateEnum
CREATE TYPE "summary_tile" AS ENUM ('SPEND', 'IMPRESSIONS', 'CLICKS', 'CONVERSIONS', 'CPC', 'KPI');

-- AlterTable
ALTER TABLE "project" ADD COLUMN "summary_tiles" "summary_tile"[] NOT NULL DEFAULT ARRAY['CONVERSIONS']::"summary_tile"[];
