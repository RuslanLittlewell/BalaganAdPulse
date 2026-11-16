ALTER TYPE "lead_origin" ADD VALUE 'WEBSITE';

CREATE TABLE "lead_intake_key" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "allowed_sites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMP(3),

    CONSTRAINT "lead_intake_key_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lead_web_source" (
    "lead_id" TEXT NOT NULL,
    "utm_source" VARCHAR(300),
    "utm_medium" VARCHAR(300),
    "utm_campaign" VARCHAR(300),
    "utm_content" VARCHAR(300),
    "utm_term" VARCHAR(300),
    "page_url" VARCHAR(2048),
    "referrer" VARCHAR(2048),
    "submitted_at" TIMESTAMP(3) NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "lead_web_source_pkey" PRIMARY KEY ("lead_id")
);

CREATE UNIQUE INDEX "lead_intake_key_project_id_key" ON "lead_intake_key"("project_id");

CREATE UNIQUE INDEX "lead_intake_key_key_key" ON "lead_intake_key"("key");

ALTER TABLE "lead_intake_key" ADD CONSTRAINT "lead_intake_key_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_web_source" ADD CONSTRAINT "lead_web_source_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
