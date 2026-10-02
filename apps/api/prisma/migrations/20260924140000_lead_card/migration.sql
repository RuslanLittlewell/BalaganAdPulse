ALTER TABLE "lead" ADD COLUMN "amount" DECIMAL(18,4),
ADD COLUMN "service" VARCHAR(200),
ADD COLUMN "telegram" VARCHAR(100),
ADD COLUMN "messenger" VARCHAR(100),
ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "lead_file" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(255) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "uploader_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_file_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lead_file_storage_key_key" ON "lead_file"("storage_key");

CREATE INDEX "lead_file_lead_id_created_at_idx" ON "lead_file"("lead_id", "created_at" DESC);

ALTER TABLE "lead_file" ADD CONSTRAINT "lead_file_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_file" ADD CONSTRAINT "lead_file_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_file" ADD CONSTRAINT "lead_file_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

