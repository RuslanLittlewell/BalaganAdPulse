-- AlterTable
ALTER TABLE "task" DROP COLUMN "kind";

-- DropEnum
DROP TYPE "task_kind";
