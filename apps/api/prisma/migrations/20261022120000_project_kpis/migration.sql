-- CreateTable
CREATE TABLE "project_kpi" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "metric" "kpi_metric" NOT NULL,
    "target" DECIMAL(18,4) NOT NULL,
    "name" TEXT,
    "value" DECIMAL(18,4),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_kpi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_kpi_project_id_position_idx" ON "project_kpi"("project_id", "position");

-- AddForeignKey
ALTER TABLE "project_kpi" ADD CONSTRAINT "project_kpi_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_kpi" ADD CONSTRAINT "project_kpi_manual_complete" CHECK (("metric"::text = 'MANUAL') = ("name" IS NOT NULL) AND ("name" IS NULL) = ("value" IS NULL));

INSERT INTO "project_kpi" ("id", "project_id", "position", "metric", "target", "name", "value", "enabled", "updated_at")
SELECT gen_random_uuid()::text, "id", 0, "kpi_metric", "kpi_target", "kpi_name", "kpi_value", true, COALESCE("kpi_updated_at", CURRENT_TIMESTAMP)
FROM "project"
WHERE "kpi_metric" IS NOT NULL AND "kpi_target" IS NOT NULL;

-- AlterTable
ALTER TABLE "project" DROP COLUMN "kpi_metric",
DROP COLUMN "kpi_target",
DROP COLUMN "kpi_name",
DROP COLUMN "kpi_value",
DROP COLUMN "kpi_updated_at";
