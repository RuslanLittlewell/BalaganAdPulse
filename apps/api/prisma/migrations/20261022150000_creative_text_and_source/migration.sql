-- AlterEnum
ALTER TYPE "creative_kind" ADD VALUE 'TEXT';

-- AlterTable
ALTER TABLE "ad_creative" ADD COLUMN "source_url" TEXT;
