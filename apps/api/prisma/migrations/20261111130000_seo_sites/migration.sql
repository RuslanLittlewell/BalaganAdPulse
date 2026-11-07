-- CreateTable
CREATE TABLE "seo_site" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "site_url" TEXT NOT NULL,
    "origin" TEXT,
    "encrypted_token" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
    "last_success_at" TIMESTAMP(3),
    "last_error" TEXT,
    "next_daily_at" TIMESTAMP(3) NOT NULL,
    "queued_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "lease_owner" TEXT,
    "lease_until" TIMESTAMP(3),
    "vitals_read_at" TIMESTAMP(3),
    "check_status" VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
    "last_check_at" TIMESTAMP(3),
    "check_error" TEXT,
    "next_check_at" TIMESTAMP(3) NOT NULL,
    "check_queued_at" TIMESTAMP(3),
    "check_lease_owner" TEXT,
    "check_lease_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_day" (
    "site_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "position" DECIMAL(10,4) NOT NULL,

    CONSTRAINT "seo_day_pkey" PRIMARY KEY ("site_id","date")
);

-- CreateTable
CREATE TABLE "seo_query_day" (
    "site_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "query" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "position" DECIMAL(10,4) NOT NULL,

    CONSTRAINT "seo_query_day_pkey" PRIMARY KEY ("site_id","date","query")
);

-- CreateTable
CREATE TABLE "seo_page_day" (
    "site_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "page" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "position" DECIMAL(10,4) NOT NULL,

    CONSTRAINT "seo_page_day_pkey" PRIMARY KEY ("site_id","date","page")
);

-- CreateTable
CREATE TABLE "seo_vital" (
    "site_id" TEXT NOT NULL,
    "device" VARCHAR(8) NOT NULL,
    "metric" VARCHAR(8) NOT NULL,
    "period_end" DATE NOT NULL,
    "p75" DECIMAL(12,4) NOT NULL,
    "good" DECIMAL(6,4) NOT NULL,
    "needs_improvement" DECIMAL(6,4) NOT NULL,
    "poor" DECIMAL(6,4) NOT NULL,

    CONSTRAINT "seo_vital_pkey" PRIMARY KEY ("site_id","device","metric")
);

-- CreateTable
CREATE TABLE "seo_vital_week" (
    "site_id" TEXT NOT NULL,
    "device" VARCHAR(8) NOT NULL,
    "metric" VARCHAR(8) NOT NULL,
    "period_end" DATE NOT NULL,
    "p75" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "seo_vital_week_pkey" PRIMARY KEY ("site_id","device","metric","period_end")
);

-- CreateTable
CREATE TABLE "seo_lab" (
    "site_id" TEXT NOT NULL,
    "device" VARCHAR(8) NOT NULL,
    "measured_at" TIMESTAMP(3) NOT NULL,
    "score" INTEGER NOT NULL,
    "lcp_ms" INTEGER NOT NULL,
    "cls" DECIMAL(8,4) NOT NULL,
    "tbt_ms" INTEGER NOT NULL,
    "fcp_ms" INTEGER NOT NULL,
    "speed_index_ms" INTEGER NOT NULL,

    CONSTRAINT "seo_lab_pkey" PRIMARY KEY ("site_id","device")
);

-- CreateTable
CREATE TABLE "seo_audit" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "finished_at" TIMESTAMP(3) NOT NULL,
    "checked" INTEGER NOT NULL,
    "not_checked" INTEGER NOT NULL,

    CONSTRAINT "seo_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_audit_page" (
    "id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" INTEGER,
    "final_url" TEXT,
    "content_type" TEXT,
    "response_ms" INTEGER,
    "in_sitemap" BOOLEAN NOT NULL,
    "has_impressions" BOOLEAN NOT NULL,
    "facts" JSONB NOT NULL,
    "problems" TEXT[],

    CONSTRAINT "seo_audit_page_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seo_site_next_daily_at_idx" ON "seo_site"("next_daily_at");

-- CreateIndex
CREATE INDEX "seo_site_next_check_at_idx" ON "seo_site"("next_check_at");

-- CreateIndex
CREATE UNIQUE INDEX "seo_site_project_id_site_url_key" ON "seo_site"("project_id", "site_url");

-- CreateIndex
CREATE UNIQUE INDEX "seo_audit_site_id_key" ON "seo_audit"("site_id");

-- CreateIndex
CREATE UNIQUE INDEX "seo_audit_page_audit_id_url_key" ON "seo_audit_page"("audit_id", "url");

-- AddForeignKey
ALTER TABLE "seo_site" ADD CONSTRAINT "seo_site_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_day" ADD CONSTRAINT "seo_day_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "seo_site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_query_day" ADD CONSTRAINT "seo_query_day_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "seo_site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_page_day" ADD CONSTRAINT "seo_page_day_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "seo_site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_vital" ADD CONSTRAINT "seo_vital_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "seo_site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_vital_week" ADD CONSTRAINT "seo_vital_week_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "seo_site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_lab" ADD CONSTRAINT "seo_lab_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "seo_site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_audit" ADD CONSTRAINT "seo_audit_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "seo_site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_audit_page" ADD CONSTRAINT "seo_audit_page_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "seo_audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

