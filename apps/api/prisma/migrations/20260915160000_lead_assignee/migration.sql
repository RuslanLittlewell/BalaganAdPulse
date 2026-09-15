ALTER TABLE "lead" ADD COLUMN "assignee_id" TEXT;

ALTER TABLE "lead"
ADD CONSTRAINT "lead_assignee_id_fkey"
FOREIGN KEY ("assignee_id") REFERENCES "membership"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "lead_assignee_id_idx" ON "lead"("assignee_id");
