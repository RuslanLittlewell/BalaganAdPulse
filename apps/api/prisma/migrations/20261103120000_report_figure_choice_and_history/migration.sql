-- AlterTable
ALTER TABLE "monthly_report" ADD COLUMN     "contacts_source" TEXT;

-- CreateTable
CREATE TABLE "project_month_figure" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "leads" INTEGER NOT NULL,
    "spend" DECIMAL(18,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_month_figure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_month_figure_project_id_month_key" ON "project_month_figure"("project_id", "month");

-- AddForeignKey
ALTER TABLE "project_month_figure" ADD CONSTRAINT "project_month_figure_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
