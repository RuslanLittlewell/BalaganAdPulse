CREATE TYPE "report_status" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "monthly_report" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "status" "report_status" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3),
    "figures" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL,
    "leads_override" INTEGER,
    "messenger_contacts" INTEGER,
    "conclusions" JSONB,
    "plan" JSONB,
    "published_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monthly_report_ad" (
    "report_id" TEXT NOT NULL,
    "ad_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "monthly_report_ad_pkey" PRIMARY KEY ("report_id","ad_id")
);

CREATE UNIQUE INDEX "monthly_report_project_id_month_key" ON "monthly_report"("project_id", "month");

CREATE INDEX "monthly_report_ad_report_id_position_idx" ON "monthly_report_ad"("report_id", "position");

CREATE INDEX "monthly_report_ad_ad_id_idx" ON "monthly_report_ad"("ad_id");

ALTER TABLE "monthly_report" ADD CONSTRAINT "monthly_report_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monthly_report" ADD CONSTRAINT "monthly_report_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "monthly_report_ad" ADD CONSTRAINT "monthly_report_ad_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "monthly_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monthly_report_ad" ADD CONSTRAINT "monthly_report_ad_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
