-- AlterEnum
ALTER TYPE "registration_type" ADD VALUE 'PARTNER';

-- AlterEnum
ALTER TYPE "role" ADD VALUE 'PARTNER';

-- AlterTable
ALTER TABLE "invite" ADD COLUMN     "campaign_id" TEXT;

-- AlterTable
ALTER TABLE "membership" ADD COLUMN     "campaign_id" TEXT;

-- CreateIndex
CREATE INDEX "invite_campaign_id_idx" ON "invite"("campaign_id");

-- CreateIndex
CREATE INDEX "membership_campaign_id_idx" ON "membership"("campaign_id");

-- AddForeignKey
ALTER TABLE "invite" ADD CONSTRAINT "invite_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
