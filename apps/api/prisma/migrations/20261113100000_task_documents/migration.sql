-- CreateTable
CREATE TABLE "task_document" (
    "id" TEXT NOT NULL,
    "task_id" TEXT,
    "uploader_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_document_task_id_idx" ON "task_document"("task_id");

-- CreateIndex
CREATE INDEX "task_document_task_id_created_at_idx" ON "task_document"("task_id", "created_at");

-- AddForeignKey
ALTER TABLE "task_document" ADD CONSTRAINT "task_document_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_document" ADD CONSTRAINT "task_document_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
