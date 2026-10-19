-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notification_kind" ADD VALUE 'TASK_UPDATED';
ALTER TYPE "notification_kind" ADD VALUE 'DOCUMENT_ADDED';
ALTER TYPE "notification_kind" ADD VALUE 'TASK_DUE_SOON';

-- AlterTable
ALTER TABLE "notification" ADD COLUMN     "document_id" TEXT;

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "due_soon_for" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "project_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

