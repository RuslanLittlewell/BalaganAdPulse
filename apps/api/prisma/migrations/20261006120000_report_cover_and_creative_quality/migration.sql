ALTER TABLE "monthly_report" ADD COLUMN "cover_key" TEXT,
ADD COLUMN "cover_content_type" TEXT;

ALTER TABLE "ad_creative" ADD COLUMN "quality" INTEGER NOT NULL DEFAULT 0;
