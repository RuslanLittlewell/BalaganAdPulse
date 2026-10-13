-- CreateTable
CREATE TABLE "project_document" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_document_project_id_created_at_idx" ON "project_document"("project_id", "created_at");

-- AddForeignKey
ALTER TABLE "project_document" ADD CONSTRAINT "project_document_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_document" ADD CONSTRAINT "project_document_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_document" ADD CONSTRAINT "project_document_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

