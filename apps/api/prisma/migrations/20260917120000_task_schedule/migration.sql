CREATE TYPE "task_repeat" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

ALTER TABLE "task" ADD COLUMN "due_date" DATE;
ALTER TABLE "task" ADD COLUMN "due_time" VARCHAR(5);
ALTER TABLE "task" ADD COLUMN "repeat_every" "task_repeat" NOT NULL DEFAULT 'NONE';

ALTER TABLE "task" ADD CONSTRAINT "task_due_time_needs_a_day" CHECK ("due_time" IS NULL OR "due_date" IS NOT NULL);
ALTER TABLE "task" ADD CONSTRAINT "task_repeat_needs_a_day" CHECK ("repeat_every" = 'NONE' OR "due_date" IS NOT NULL);

CREATE INDEX "task_org_id_due_date_idx" ON "task"("org_id", "due_date");

CREATE TABLE "task_checklist_item" (
  "id" TEXT PRIMARY KEY,
  "task_id" TEXT NOT NULL REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "title" TEXT NOT NULL,
  "done" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL
);

CREATE INDEX "task_checklist_item_task_id_position_idx" ON "task_checklist_item"("task_id", "position");
