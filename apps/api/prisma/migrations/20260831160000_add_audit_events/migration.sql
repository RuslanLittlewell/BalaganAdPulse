-- The audit trail is append-only product history. Actor details and the
-- readable summary are denormalized so an event remains useful after the
-- member or business entity it describes has changed or been removed.

CREATE TYPE "audit_action" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

CREATE TABLE "audit_event" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "actor_email" TEXT NOT NULL,
    "actor_role" "role" NOT NULL,
    "action" "audit_action" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "client_id" TEXT,
    "project_id" TEXT,
    "campaign_id" TEXT,
    "summary" TEXT NOT NULL,
    "changes" JSONB,
    "request_id" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_event_org_id_created_at_idx"
    ON "audit_event"("org_id", "created_at" DESC);
CREATE INDEX "audit_event_project_id_created_at_idx"
    ON "audit_event"("project_id", "created_at" DESC);
CREATE INDEX "audit_event_client_id_created_at_idx"
    ON "audit_event"("client_id", "created_at" DESC);
CREATE INDEX "audit_event_entity_type_entity_id_created_at_idx"
    ON "audit_event"("entity_type", "entity_id", "created_at" DESC);

ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The API can append and read history, but it cannot rewrite or erase it.
REVOKE UPDATE, DELETE ON TABLE "audit_event" FROM CURRENT_USER;
