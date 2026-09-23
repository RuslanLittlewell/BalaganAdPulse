DROP INDEX "task_campaign_id_idx";

ALTER TABLE "task" DROP CONSTRAINT "task_campaign_id_fkey";

ALTER TABLE "task" DROP COLUMN "campaign_id";
