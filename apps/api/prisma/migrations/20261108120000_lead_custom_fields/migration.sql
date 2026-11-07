-- CreateEnum
CREATE TYPE "lead_field_type" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT', 'CHECKBOX', 'LINK');

-- AlterTable
ALTER TABLE "lead" ADD COLUMN     "custom_values" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "lead_field" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "type" "lead_field_type" NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "position" INTEGER NOT NULL DEFAULT 0 CHECK ("position" >= 0),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_field_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_field_project_id_position_idx" ON "lead_field"("project_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "lead_field_board_name_key" ON "lead_field" ("project_id", lower("name"));

-- AddForeignKey
ALTER TABLE "lead_field" ADD CONSTRAINT "lead_field_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_field" ADD CONSTRAINT "lead_field_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
