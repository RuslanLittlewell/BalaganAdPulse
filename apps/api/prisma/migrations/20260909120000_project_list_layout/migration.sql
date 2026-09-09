CREATE TABLE "project_group" (
  "id" TEXT PRIMARY KEY,
  "membership_id" TEXT NOT NULL REFERENCES "membership"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "project_group_membership_id_position_idx" ON "project_group"("membership_id", "position");

CREATE TABLE "project_placement" (
  "membership_id" TEXT NOT NULL REFERENCES "membership"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "project_id" TEXT NOT NULL REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "group_id" TEXT REFERENCES "project_group"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "position" INTEGER NOT NULL,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY ("membership_id", "project_id")
);
CREATE INDEX "project_placement_membership_id_position_idx" ON "project_placement"("membership_id", "position");
CREATE INDEX "project_placement_group_id_idx" ON "project_placement"("group_id");
