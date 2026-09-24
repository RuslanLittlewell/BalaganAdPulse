DELETE FROM "lead" WHERE "client_id" IS NULL OR "project_id" IS NULL;

WITH "ranked" AS (
  SELECT "lead"."id",
         ROW_NUMBER() OVER (
           PARTITION BY "lead"."project_id", COALESCE("lead"."stage", 'NEW'::"lead_stage")
           ORDER BY ("lead"."column_id" IS NOT NULL), "lead_column"."after_stage" NULLS FIRST,
                    "lead_column"."position", "lead"."position", "lead"."id"
         ) - 1 AS "position"
  FROM "lead"
  LEFT JOIN "lead_column" ON "lead_column"."id" = "lead"."column_id"
)
UPDATE "lead"
SET "position" = "ranked"."position",
    "stage" = COALESCE("lead"."stage", 'NEW'::"lead_stage"),
    "column_id" = NULL
FROM "ranked"
WHERE "ranked"."id" = "lead"."id";

DELETE FROM "lead_column";

ALTER TABLE "lead" DROP CONSTRAINT "lead_client_id_org_id_fkey";
ALTER TABLE "lead" DROP CONSTRAINT "lead_project_id_fkey";
ALTER TABLE "lead_column" DROP CONSTRAINT "lead_column_client_id_org_id_fkey";

DROP INDEX "lead_org_id_client_id_stage_position_idx";
DROP INDEX "lead_project_id_idx";
DROP INDEX "lead_column_org_id_client_id_after_stage_position_idx";
DROP INDEX "lead_column_board_name_key";

ALTER TABLE "lead" DROP COLUMN "client_id",
ALTER COLUMN "project_id" SET NOT NULL;

ALTER TABLE "lead_column" DROP COLUMN "client_id",
ADD COLUMN "project_id" TEXT NOT NULL;

CREATE INDEX "lead_project_id_stage_position_idx" ON "lead"("project_id", "stage", "position");
CREATE INDEX "lead_column_project_id_after_stage_position_idx" ON "lead_column"("project_id", "after_stage", "position");
CREATE UNIQUE INDEX "lead_column_board_name_key" ON "lead_column" ("project_id", lower("name"));

ALTER TABLE "lead_column" ADD CONSTRAINT "lead_column_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead" ADD CONSTRAINT "lead_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
