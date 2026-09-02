-- A task may name one campaign of its project. Null means the project as a
-- whole, which is what every existing task already means.
ALTER TABLE "task" ADD COLUMN "campaign_id" TEXT;

-- SET NULL, not CASCADE: a task is work somebody owns and outlives the campaign
-- it was about. Deleting a campaign leaves its tasks standing, unattached.
ALTER TABLE "task"
  ADD CONSTRAINT "task_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "task_campaign_id_idx" ON "task"("campaign_id");
