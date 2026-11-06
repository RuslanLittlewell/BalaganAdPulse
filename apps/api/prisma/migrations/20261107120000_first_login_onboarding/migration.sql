-- AlterTable
ALTER TABLE "membership" ADD COLUMN "welcomed_at" TIMESTAMP(3),
ADD COLUMN "onboarding_hidden_at" TIMESTAMP(3);

UPDATE "membership" SET "welcomed_at" = CURRENT_TIMESTAMP, "onboarding_hidden_at" = CURRENT_TIMESTAMP;
