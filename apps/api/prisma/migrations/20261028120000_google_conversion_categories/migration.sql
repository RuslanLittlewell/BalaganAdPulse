ALTER TABLE "campaign" ADD COLUMN "conversion_categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "campaign_daily_result" (
  "campaign_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "category" TEXT NOT NULL,
  "results" DECIMAL(14,4) NOT NULL,
  "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_daily_result_pkey" PRIMARY KEY ("campaign_id", "date", "category")
);
CREATE INDEX "campaign_daily_result_date_idx" ON "campaign_daily_result"("date");
ALTER TABLE "campaign_daily_result" ADD CONSTRAINT "campaign_daily_result_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ad_set_daily_result" (
  "ad_set_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "category" TEXT NOT NULL,
  "results" DECIMAL(14,4) NOT NULL,
  "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ad_set_daily_result_pkey" PRIMARY KEY ("ad_set_id", "date", "category")
);
CREATE INDEX "ad_set_daily_result_date_idx" ON "ad_set_daily_result"("date");
ALTER TABLE "ad_set_daily_result" ADD CONSTRAINT "ad_set_daily_result_ad_set_id_fkey"
  FOREIGN KEY ("ad_set_id") REFERENCES "ad_set"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ad_daily_result" (
  "ad_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "category" TEXT NOT NULL,
  "results" DECIMAL(14,4) NOT NULL,
  "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ad_daily_result_pkey" PRIMARY KEY ("ad_id", "date", "category")
);
CREATE INDEX "ad_daily_result_date_idx" ON "ad_daily_result"("date");
ALTER TABLE "ad_daily_result" ADD CONSTRAINT "ad_daily_result_ad_id_fkey"
  FOREIGN KEY ("ad_id") REFERENCES "ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
