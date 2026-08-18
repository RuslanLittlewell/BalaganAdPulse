/*
  Warnings:

  - Added the required column `owner_id` to the `client` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "client" ADD COLUMN     "owner_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "client_owner_id_created_at_idx" ON "client"("owner_id", "created_at");

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
