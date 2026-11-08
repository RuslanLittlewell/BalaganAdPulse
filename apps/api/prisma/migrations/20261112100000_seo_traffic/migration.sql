-- AlterTable
ALTER TABLE "seo_site" ADD COLUMN     "analytics_property_id" TEXT,
ADD COLUMN     "analytics_name" TEXT,
ADD COLUMN     "traffic_status" VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
ADD COLUMN     "traffic_success_at" TIMESTAMP(3),
ADD COLUMN     "traffic_error" TEXT,
ADD COLUMN     "next_traffic_at" TIMESTAMP(3),
ADD COLUMN     "traffic_queued_at" TIMESTAMP(3),
ADD COLUMN     "traffic_retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "traffic_lease_owner" TEXT,
ADD COLUMN     "traffic_lease_until" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "seo_traffic_day" (
    "site_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "channel" VARCHAR(128) NOT NULL,
    "source" VARCHAR(255) NOT NULL,
    "medium" VARCHAR(255) NOT NULL,
    "sessions" INTEGER NOT NULL,

    CONSTRAINT "seo_traffic_day_pkey" PRIMARY KEY ("site_id","date","channel","source","medium")
);

-- CreateIndex
CREATE INDEX "seo_traffic_day_site_id_date_idx" ON "seo_traffic_day"("site_id", "date");

-- CreateIndex
CREATE INDEX "seo_site_next_traffic_at_idx" ON "seo_site"("next_traffic_at");

-- AddForeignKey
ALTER TABLE "seo_traffic_day" ADD CONSTRAINT "seo_traffic_day_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "seo_site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
