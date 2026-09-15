CREATE TABLE "lead_column" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "client_id" TEXT,
    "name" VARCHAR(50) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0 CHECK ("position" >= 0),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lead_column_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_column_org_id_client_id_position_idx" ON "lead_column"("org_id", "client_id", "position");

CREATE UNIQUE INDEX "lead_column_board_name_key" ON "lead_column" ("org_id", coalesce("client_id", ''), lower("name"));

ALTER TABLE "lead_column" ADD CONSTRAINT "lead_column_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_column" ADD CONSTRAINT "lead_column_client_id_org_id_fkey" FOREIGN KEY ("client_id", "org_id") REFERENCES "client"("id", "org_id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "lead" AS moved
SET "stage" = 'NEW', "position" = ranked."next_position"
FROM (
    SELECT l."id",
        coalesce((
            SELECT max(n."position") + 1
            FROM "lead" n
            WHERE n."org_id" = l."org_id" AND n."client_id" IS NOT DISTINCT FROM l."client_id" AND n."stage" = 'NEW'
        ), 0)
        + row_number() OVER (
            PARTITION BY l."org_id", l."client_id"
            ORDER BY array_position(ARRAY['CONTACTED', 'NEGOTIATION', 'WON', 'LOST', 'DEFERRED'], l."stage"::text), l."position", l."id"
        ) - 1 AS "next_position"
    FROM "lead" l
    WHERE l."stage"::text IN ('CONTACTED', 'NEGOTIATION', 'WON', 'LOST', 'DEFERRED')
) AS ranked
WHERE moved."id" = ranked."id";

ALTER TYPE "lead_stage" RENAME TO "lead_stage_old";

CREATE TYPE "lead_stage" AS ENUM ('NEW', 'QUALIFIED', 'TARGET', 'PROPOSAL');

ALTER TABLE "lead" ALTER COLUMN "stage" DROP DEFAULT;

ALTER TABLE "lead" ALTER COLUMN "stage" TYPE "lead_stage" USING ("stage"::text::"lead_stage");

ALTER TABLE "lead" ALTER COLUMN "stage" DROP NOT NULL;

ALTER TABLE "lead" ALTER COLUMN "stage" SET DEFAULT 'NEW';

DROP TYPE "lead_stage_old";

ALTER TABLE "lead" ADD COLUMN "column_id" TEXT;

CREATE INDEX "lead_column_id_idx" ON "lead"("column_id");

ALTER TABLE "lead" ADD CONSTRAINT "lead_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "lead_column"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "lead" ADD CONSTRAINT "lead_stage_or_column_check" CHECK (("stage" IS NULL) <> ("column_id" IS NULL));
