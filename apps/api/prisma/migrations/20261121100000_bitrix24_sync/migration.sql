CREATE TABLE "bitrix24_connection" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "portal_host" TEXT NOT NULL,
    "sealed_webhook" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "webhook_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "inbound_project_id" TEXT,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "lease_owner" TEXT,
    "lease_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bitrix24_connection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bitrix24_stage_link" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "stage_key" TEXT NOT NULL,
    "status_id" TEXT NOT NULL,

    CONSTRAINT "bitrix24_stage_link_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bitrix24_link" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,
    "remote_id" TEXT NOT NULL,
    "remote_modified_at" TIMESTAMP(3),
    "local_synced_at" TIMESTAMP(3) NOT NULL,
    "dropped" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitrix24_link_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bitrix24_inbox" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "remote_id" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitrix24_inbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bitrix24_problem" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "failed_for" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitrix24_problem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bitrix24_run" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'RUNNING',
    "created" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "cursor" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "bitrix24_run_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bitrix24_connection_org_id_key" ON "bitrix24_connection"("org_id");
CREATE UNIQUE INDEX "bitrix24_connection_webhook_key_key" ON "bitrix24_connection"("webhook_key");
CREATE UNIQUE INDEX "bitrix24_stage_link_connection_id_stage_key_key" ON "bitrix24_stage_link"("connection_id", "stage_key");
CREATE UNIQUE INDEX "bitrix24_stage_link_connection_id_status_id_key" ON "bitrix24_stage_link"("connection_id", "status_id");
CREATE UNIQUE INDEX "bitrix24_link_connection_id_kind_local_id_key" ON "bitrix24_link"("connection_id", "kind", "local_id");
CREATE UNIQUE INDEX "bitrix24_link_connection_id_kind_remote_id_key" ON "bitrix24_link"("connection_id", "kind", "remote_id");
CREATE INDEX "bitrix24_inbox_connection_id_received_at_idx" ON "bitrix24_inbox"("connection_id", "received_at");
CREATE UNIQUE INDEX "bitrix24_inbox_connection_id_kind_remote_id_key" ON "bitrix24_inbox"("connection_id", "kind", "remote_id");
CREATE UNIQUE INDEX "bitrix24_problem_connection_id_kind_key_key" ON "bitrix24_problem"("connection_id", "kind", "key");
CREATE INDEX "bitrix24_run_connection_id_started_at_idx" ON "bitrix24_run"("connection_id", "started_at");

ALTER TABLE "bitrix24_connection" ADD CONSTRAINT "bitrix24_connection_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bitrix24_stage_link" ADD CONSTRAINT "bitrix24_stage_link_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "bitrix24_connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bitrix24_link" ADD CONSTRAINT "bitrix24_link_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "bitrix24_connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bitrix24_inbox" ADD CONSTRAINT "bitrix24_inbox_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "bitrix24_connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bitrix24_problem" ADD CONSTRAINT "bitrix24_problem_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "bitrix24_connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bitrix24_run" ADD CONSTRAINT "bitrix24_run_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "bitrix24_connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
