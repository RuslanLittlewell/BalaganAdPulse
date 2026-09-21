ALTER TABLE "lead_column" ADD COLUMN "after_stage" "lead_stage";

UPDATE "lead_column" SET "after_stage" = 'PROPOSAL';

DROP INDEX "lead_column_org_id_client_id_position_idx";

CREATE INDEX "lead_column_org_id_client_id_after_stage_position_idx" ON "lead_column"("org_id", "client_id", "after_stage", "position");
