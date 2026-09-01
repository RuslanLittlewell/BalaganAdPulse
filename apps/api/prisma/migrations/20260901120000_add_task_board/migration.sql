-- The task board. Purely additive: no existing table, column or row is touched,
-- so existing data survives untouched and a rollback is a pair of DROPs.

CREATE TYPE "task_column" AS ENUM ('IDEA', 'ARCHIVED', 'IN_PROGRESS', 'NEEDS_FIX', 'IN_REVIEW', 'DONE');
CREATE TYPE "task_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" JSONB,
    "column" "task_column" NOT NULL DEFAULT 'IDEA',
    "priority" "task_priority" NOT NULL,
    "assignee_id" TEXT,
    "created_by_id" TEXT,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- The board reads by organization, column and position; the filter reads by project.
CREATE INDEX "task_org_id_column_position_idx" ON "task"("org_id", "column", "position");
CREATE INDEX "task_project_id_idx" ON "task"("project_id");

ALTER TABLE "task" ADD CONSTRAINT "task_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task" ADD CONSTRAINT "task_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- SET NULL, not CASCADE: removing a member leaves their tasks on the board,
-- unassigned, rather than deleting work that still has to be done.
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_fkey"
    FOREIGN KEY ("assignee_id") REFERENCES "membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "task" ADD CONSTRAINT "task_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "task_image" (
    "id" TEXT NOT NULL,
    "task_id" TEXT,
    "uploader_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_image_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_image_task_id_idx" ON "task_image"("task_id");
-- `task_id IS NULL AND created_at < ...` is the sweep for uploads abandoned
-- before their task was ever saved.
CREATE INDEX "task_image_task_id_created_at_idx" ON "task_image"("task_id", "created_at");

ALTER TABLE "task_image" ADD CONSTRAINT "task_image_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_image" ADD CONSTRAINT "task_image_uploader_id_fkey"
    FOREIGN KEY ("uploader_id") REFERENCES "membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
