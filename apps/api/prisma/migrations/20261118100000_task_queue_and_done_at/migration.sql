ALTER TYPE "task_column" ADD VALUE 'QUEUED' AFTER 'IDEA';

ALTER TABLE "task" ADD COLUMN "done_at" TIMESTAMP(3);

UPDATE "task" SET "done_at" = CURRENT_TIMESTAMP WHERE "column" = 'DONE';

CREATE INDEX "task_done_at_idx" ON "task"("done_at");
