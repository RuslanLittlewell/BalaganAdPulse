-- AlterTable
ALTER TABLE "task" ADD COLUMN     "lead_id" TEXT;

-- CreateTable
CREATE TABLE "lead_note" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "author_id" TEXT,
    "body" VARCHAR(5000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),

    CONSTRAINT "lead_note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_note_lead_id_created_at_idx" ON "lead_note"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "task_lead_id_idx" ON "task"("lead_id");

-- AddForeignKey
ALTER TABLE "lead_note" ADD CONSTRAINT "lead_note_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_note" ADD CONSTRAINT "lead_note_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_note" ADD CONSTRAINT "lead_note_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

