-- AlterTable
ALTER TABLE "audit_event" ADD COLUMN     "lead_id" TEXT;

GRANT UPDATE ("lead_id") ON TABLE "audit_event" TO CURRENT_USER;

UPDATE "audit_event" SET "lead_id" = "entity_id" WHERE "entity_type" = 'lead';

UPDATE "audit_event" AS e SET "lead_id" = t."lead_id"
FROM "task" AS t
WHERE e."entity_type" = 'task' AND e."entity_id" = t."id" AND t."lead_id" IS NOT NULL;

REVOKE UPDATE ("lead_id") ON TABLE "audit_event" FROM CURRENT_USER;
