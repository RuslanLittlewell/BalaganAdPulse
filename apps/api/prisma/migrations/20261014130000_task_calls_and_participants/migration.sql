-- CreateEnum
CREATE TYPE "task_kind" AS ENUM ('TASK', 'CALL');

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "kind" "task_kind" NOT NULL DEFAULT 'TASK';

-- CreateTable
CREATE TABLE "task_participant" (
    "task_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,

    CONSTRAINT "task_participant_pkey" PRIMARY KEY ("task_id","membership_id")
);

-- CreateIndex
CREATE INDEX "task_participant_membership_id_idx" ON "task_participant"("membership_id");

-- AddForeignKey
ALTER TABLE "task_participant" ADD CONSTRAINT "task_participant_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_participant" ADD CONSTRAINT "task_participant_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

