-- Whether the customer is shown a task. False for everything that exists: no
-- client has ever been able to see a task, so every one of them is the agency's
-- own, which is exactly what the default says.
ALTER TABLE "task" ADD COLUMN "visible_to_client" BOOLEAN NOT NULL DEFAULT false;

-- The client's board reads this column with the organization; nothing else does.
CREATE INDEX "task_org_id_visible_to_client_idx" ON "task"("org_id", "visible_to_client");
