CREATE TABLE "project_integration" (
  "project_id" TEXT PRIMARY KEY REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "account_id" TEXT NOT NULL,
  "encrypted_token" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "revision" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "last_success_at" TIMESTAMP(3),
  "last_error" TEXT,
  "next_daily_at" TIMESTAMP(3) NOT NULL,
  "queued_at" TIMESTAMP(3),
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "lease_owner" TEXT,
  "lease_until" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "project_integration_next_daily_at_idx" ON "project_integration"("next_daily_at");
CREATE INDEX "project_integration_queued_at_idx" ON "project_integration"("queued_at");
