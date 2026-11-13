-- CreateTable
CREATE TABLE "meta_dataset" (
    "project_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "dataset_id" VARCHAR(32) NOT NULL,
    "dataset_name" TEXT NOT NULL,
    "encrypted_token" TEXT NOT NULL,
    "test_event_code" VARCHAR(64),
    "currency" VARCHAR(3) NOT NULL,
    "state" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    "last_error" TEXT,
    "last_sent_at" TIMESTAMP(3),
    "revision" TEXT NOT NULL,
    "lease_owner" TEXT,
    "lease_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_dataset_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "meta_conversion_send" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "event_id" TEXT,
    "event_name" VARCHAR(50) NOT NULL,
    "reached_at" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "hold_until" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL,
    "last_error" TEXT,
    "value" DECIMAL(18,4),
    "currency" VARCHAR(3),
    "test" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_conversion_send_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_stage_change" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "from_stage" TEXT,
    "to_stage" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "lead_stage_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_conversion_event" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "name_key" VARCHAR(50) NOT NULL,
    "stages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "carries_amount" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_conversion_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meta_conversion_send_project_id_status_next_attempt_at_idx" ON "meta_conversion_send"("project_id", "status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "meta_conversion_send_project_id_reached_at_idx" ON "meta_conversion_send"("project_id", "reached_at" DESC);

-- CreateIndex
CREATE INDEX "meta_conversion_send_status_reached_at_idx" ON "meta_conversion_send"("status", "reached_at");

-- CreateIndex
CREATE UNIQUE INDEX "meta_conversion_send_lead_id_event_id_key" ON "meta_conversion_send"("lead_id", "event_id");

-- CreateIndex
CREATE INDEX "lead_stage_change_lead_id_changed_at_idx" ON "lead_stage_change"("lead_id", "changed_at");

-- CreateIndex
CREATE INDEX "lead_stage_change_project_id_changed_at_idx" ON "lead_stage_change"("project_id", "changed_at");

-- CreateIndex
CREATE INDEX "lead_stage_change_processed_at_idx" ON "lead_stage_change"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "crm_conversion_event_project_id_name_key_key" ON "crm_conversion_event"("project_id", "name_key");

-- AddForeignKey
ALTER TABLE "meta_dataset" ADD CONSTRAINT "meta_dataset_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_conversion_send" ADD CONSTRAINT "meta_conversion_send_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_conversion_send" ADD CONSTRAINT "meta_conversion_send_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_conversion_send" ADD CONSTRAINT "meta_conversion_send_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "crm_conversion_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_stage_change" ADD CONSTRAINT "lead_stage_change_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_stage_change" ADD CONSTRAINT "lead_stage_change_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_conversion_event" ADD CONSTRAINT "crm_conversion_event_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;


INSERT INTO "lead_stage_change" ("id", "org_id", "project_id", "lead_id", "from_stage", "to_stage", "changed_at", "processed_at")
SELECT gen_random_uuid()::text, l."org_id", l."project_id", l."id", NULL,
  COALESCE((
    SELECT a."changes"->'after'->>'stage' FROM "audit_event" a
    WHERE a."entity_type" = 'lead' AND a."entity_id" = l."id" AND a."action" = 'CREATE'
    ORDER BY a."created_at" LIMIT 1
  ), 'NEW'),
  l."created_at", CURRENT_TIMESTAMP
FROM "lead" l;

INSERT INTO "lead_stage_change" ("id", "org_id", "project_id", "lead_id", "from_stage", "to_stage", "changed_at", "processed_at")
SELECT gen_random_uuid()::text, l."org_id", l."project_id", l."id",
  a."changes"->'before'->>'stage', a."changes"->'after'->>'stage', a."created_at", CURRENT_TIMESTAMP
FROM "audit_event" a
JOIN "lead" l ON l."id" = a."entity_id"
WHERE a."entity_type" = 'lead' AND a."action" = 'UPDATE'
  AND a."changes"->'before'->>'stage' IS NOT NULL
  AND a."changes"->'after'->>'stage' IS NOT NULL
  AND a."changes"->'before'->>'stage' <> a."changes"->'after'->>'stage';
