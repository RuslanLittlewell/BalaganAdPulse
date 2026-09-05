CREATE TYPE "lead_stage" AS ENUM ('NEW','CONTACTED','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST','DEFERRED');
CREATE UNIQUE INDEX "client_id_org_id_key" ON "client"("id", "org_id");
CREATE TABLE "lead" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "org_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "client_id" TEXT,
  "name" VARCHAR(200) NOT NULL,
  "company" VARCHAR(200), "phone" VARCHAR(50), "email" VARCHAR(254),
  "telegram" VARCHAR(100), "website" VARCHAR(2048), "source" VARCHAR(200), "notes" VARCHAR(10000),
  "stage" "lead_stage" NOT NULL DEFAULT 'NEW',
  "position" INTEGER NOT NULL DEFAULT 0 CHECK ("position" >= 0),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("client_id", "org_id") REFERENCES "client"("id", "org_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "lead_org_id_client_id_stage_position_idx" ON "lead"("org_id", "client_id", "stage", "position");
