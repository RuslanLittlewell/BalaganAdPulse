-- CreateTable
CREATE TABLE "project_account_summary" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "channel" "channel" NOT NULL,
    "account_id" TEXT NOT NULL,
    "tiles" "summary_tile"[] DEFAULT ARRAY[]::"summary_tile"[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_account_summary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_account_summary_project_id_channel_account_id_key" ON "project_account_summary"("project_id", "channel", "account_id");

-- AddForeignKey
ALTER TABLE "project_account_summary" ADD CONSTRAINT "project_account_summary_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

