-- AlterTable
ALTER TABLE "membership" ADD COLUMN "dashboard_tiles" "summary_tile"[] NOT NULL DEFAULT ARRAY['CONVERSIONS']::"summary_tile"[];
