CREATE TABLE "lead_stage_name" (
    "project_id" TEXT NOT NULL,
    "stage" "lead_stage" NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_stage_name_pkey" PRIMARY KEY ("project_id","stage")
);

ALTER TABLE "lead_stage_name" ADD CONSTRAINT "lead_stage_name_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
