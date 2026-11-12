-- CreateTable
CREATE TABLE "project_share_link" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_share_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_share_link_project_id_key" ON "project_share_link"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_share_link_token_key" ON "project_share_link"("token");

-- AddForeignKey
ALTER TABLE "project_share_link" ADD CONSTRAINT "project_share_link_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_share_link" ADD CONSTRAINT "project_share_link_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
