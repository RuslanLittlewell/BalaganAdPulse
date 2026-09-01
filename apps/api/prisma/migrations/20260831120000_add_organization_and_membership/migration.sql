-- Tenancy. A client stops belonging to the user who typed it in and starts
-- belonging to the agency; who may reach it becomes a question of role and
-- grant rather than of a foreign key.
--
-- `owner_id` deliberately survives this migration. The grants that replace it
-- are built from it in the next one, so until those are in place and proven the
-- old answer is still on disk and the inverse migration is a column rename.

CREATE TYPE "role" AS ENUM ('ADMIN', 'MANAGER', 'GUEST', 'CLIENT');
CREATE TYPE "membership_status" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

CREATE TABLE "membership" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "role" "role" NOT NULL,
    "status" "membership_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "membership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "membership_user_id_org_id_key" ON "membership"("user_id", "org_id");
CREATE INDEX "membership_org_id_role_idx" ON "membership"("org_id", "role");

ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "membership" ADD CONSTRAINT "membership_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one organization, always. A fresh database gets it too, so `org_id`
-- below can be NOT NULL without a nullable interlude, and no code path ever has
-- to answer "what if there is no organization yet". The seed command renames it
-- and adds the first admin; multi-organization routing is a later change.
INSERT INTO "organization" ("id", "name", "slug", "created_at", "updated_at")
VALUES (gen_random_uuid()::text, 'AdPulse', 'adpulse', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Everyone who already had an account keeps working, as a member. The oldest
-- account becomes the admin: on a single-user install that is the person who
-- has been running the product, and on a fresh one this selects nothing.
INSERT INTO "membership" ("id", "user_id", "org_id", "role", "status", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    u."id",
    o."id",
    CASE
        WHEN u."id" = (
            SELECT oldest."id" FROM "app_user" oldest
            ORDER BY oldest."created_at" ASC, oldest."id" ASC
            LIMIT 1
        ) THEN 'ADMIN'::"role"
        ELSE 'MANAGER'::"role"
    END,
    'ACTIVE'::"membership_status",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "app_user" u
CROSS JOIN "organization" o;

-- Added nullable, backfilled, then tightened: a NOT NULL column with no default
-- cannot be added to a table that already holds rows.
ALTER TABLE "client" ADD COLUMN "org_id" TEXT;
UPDATE "client" SET "org_id" = (SELECT "id" FROM "organization" LIMIT 1);
ALTER TABLE "client" ALTER COLUMN "org_id" SET NOT NULL;

ALTER TABLE "client" ADD CONSTRAINT "client_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "client_org_id_created_at_idx" ON "client"("org_id", "created_at");
