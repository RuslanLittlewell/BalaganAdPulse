-- The campaign sheet goes, and the platform hierarchy takes its place.
--
-- Every campaign in the database predates channels: each was auto-seeded by
-- project creation purely to give the sheet somewhere to live, and there is no
-- truthful channel to backfill it with. They are removed here rather than
-- carried forward, because a campaign now means something that ran on an ad
-- platform and these never did. Neither they nor the sheet's rows are
-- recoverable afterwards.

DROP TABLE "campaign_property_value";
DROP TABLE "campaign_record";
DROP TABLE "campaign_property";
DROP TYPE "property_type";

DELETE FROM "campaign";

CREATE TYPE "channel" AS ENUM ('META', 'GOOGLE', 'YANDEX', 'VK', 'TIKTOK', 'LINKEDIN', 'TELEGRAM');
CREATE TYPE "delivery_status" AS ENUM ('ACTIVE', 'LEARNING', 'PAUSED', 'REJECTED', 'ENDED');

ALTER TABLE "campaign"
  ADD COLUMN "channel" "channel" NOT NULL,
  ADD COLUMN "status" "delivery_status" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "objective" TEXT,
  ADD COLUMN "external_id" TEXT;

-- Per channel, not globally: two platforms may hand out the same id.
CREATE UNIQUE INDEX "campaign_channel_external_id_key" ON "campaign"("channel", "external_id");

CREATE TABLE "ad_set" (
  "id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "audience" TEXT,
  "status" "delivery_status" NOT NULL DEFAULT 'ACTIVE',
  "external_id" TEXT,
  "position" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ad_set_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ad_set_campaign_id_position_idx" ON "ad_set"("campaign_id", "position");
ALTER TABLE "ad_set" ADD CONSTRAINT "ad_set_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ad" (
  "id" TEXT NOT NULL,
  "ad_set_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "format" TEXT,
  "headline" TEXT,
  "status" "delivery_status" NOT NULL DEFAULT 'ACTIVE',
  "external_id" TEXT,
  "position" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ad_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ad_ad_set_id_position_idx" ON "ad"("ad_set_id", "position");
ALTER TABLE "ad" ADD CONSTRAINT "ad_ad_set_id_fkey"
  FOREIGN KEY ("ad_set_id") REFERENCES "ad_set"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One row per entity per day. The primary key is (entity, date) so a repeated
-- sync of the same day replaces it: platforms restate a day's figures as
-- attribution settles, and appending would silently double that day's spend.
--
-- No ratio is stored. They are derived on read, so a stored total and a stored
-- ratio can never disagree.
CREATE TABLE "campaign_daily_metric" (
  "campaign_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "spend" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "reach" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "conversions" INTEGER NOT NULL DEFAULT 0,
  "revenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_daily_metric_pkey" PRIMARY KEY ("campaign_id", "date")
);
CREATE INDEX "campaign_daily_metric_date_idx" ON "campaign_daily_metric"("date");
ALTER TABLE "campaign_daily_metric" ADD CONSTRAINT "campaign_daily_metric_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ad_set_daily_metric" (
  "ad_set_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "spend" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "reach" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "conversions" INTEGER NOT NULL DEFAULT 0,
  "revenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ad_set_daily_metric_pkey" PRIMARY KEY ("ad_set_id", "date")
);
CREATE INDEX "ad_set_daily_metric_date_idx" ON "ad_set_daily_metric"("date");
ALTER TABLE "ad_set_daily_metric" ADD CONSTRAINT "ad_set_daily_metric_ad_set_id_fkey"
  FOREIGN KEY ("ad_set_id") REFERENCES "ad_set"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ad_daily_metric" (
  "ad_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "spend" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "reach" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "conversions" INTEGER NOT NULL DEFAULT 0,
  "revenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ad_daily_metric_pkey" PRIMARY KEY ("ad_id", "date")
);
CREATE INDEX "ad_daily_metric_date_idx" ON "ad_daily_metric"("date");
ALTER TABLE "ad_daily_metric" ADD CONSTRAINT "ad_daily_metric_ad_id_fkey"
  FOREIGN KEY ("ad_id") REFERENCES "ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
