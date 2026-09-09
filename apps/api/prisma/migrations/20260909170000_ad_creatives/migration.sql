CREATE TYPE "creative_kind" AS ENUM ('IMAGE', 'VIDEO');

CREATE TABLE "ad_creative" (
  "id" TEXT PRIMARY KEY,
  "ad_id" TEXT NOT NULL REFERENCES "ad"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "external_id" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "kind" "creative_kind" NOT NULL,
  "title" TEXT,
  "body" TEXT,
  "file_key" TEXT,
  "content_type" TEXT,
  "bytes" INTEGER,
  "poster_key" TEXT,
  "poster_content_type" TEXT,
  "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ad_creative_ad_id_external_id_position_key" ON "ad_creative"("ad_id", "external_id", "position");
CREATE INDEX "ad_creative_ad_id_position_idx" ON "ad_creative"("ad_id", "position");
