CREATE TYPE "registration_type" AS ENUM ('CLIENT', 'EMPLOYEE');

ALTER TABLE "invite"
  ADD COLUMN "registration_type" "registration_type" NOT NULL DEFAULT 'EMPLOYEE',
  ALTER COLUMN "role" DROP NOT NULL;

CREATE TABLE "invite_project" (
  "invite_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invite_project_pkey" PRIMARY KEY ("invite_id", "project_id")
);

CREATE INDEX "invite_project_project_id_idx" ON "invite_project"("project_id");

ALTER TABLE "invite_project" ADD CONSTRAINT "invite_project_invite_id_fkey"
  FOREIGN KEY ("invite_id") REFERENCES "invite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invite_project" ADD CONSTRAINT "invite_project_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing invitations remain untouched as history. They are EMPLOYEE rows
-- without project relations and therefore do not enter the actionable list.
