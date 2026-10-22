ALTER TABLE "task" ADD COLUMN "archived_at" TIMESTAMP(3);

UPDATE "task" SET "archived_at" = "updated_at" WHERE "column" = 'ARCHIVED';
