-- AlterEnum
ALTER TYPE "notification_kind" ADD VALUE 'LEAD_MENTIONED';

-- AlterTable
ALTER TABLE "lead_note" ADD COLUMN     "mention_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "notification" ADD COLUMN     "lead_id" TEXT;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

