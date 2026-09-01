-- Row reach becomes an explicit grant. The role already decides which verbs a
-- member may use; this decides which clients and projects they may use them on.
-- Admins are not granted anything: they reach their whole organization by role.
--
-- `client.owner_id` is still here, and is what the backfill reads. It is dropped
-- in a later migration, once the grant-based lookups have been proven, so the
-- window in which the old answer is unavailable is one migration wide.

CREATE TABLE "client_access" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "project_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_access_membership_id_client_id_project_id_key"
    ON "client_access"("membership_id", "client_id", "project_id");
CREATE INDEX "client_access_client_id_idx" ON "client_access"("client_id");

-- Postgres treats two NULLs as distinct in a unique index, so the constraint
-- above would happily accept the same whole-client grant twice. This is the one
-- that actually forbids it.
CREATE UNIQUE INDEX "client_access_whole_client_key"
    ON "client_access" ("membership_id", "client_id")
    WHERE "project_id" IS NULL;

ALTER TABLE "client_access" ADD CONSTRAINT "client_access_membership_id_fkey"
    FOREIGN KEY ("membership_id") REFERENCES "membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_access" ADD CONSTRAINT "client_access_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_access" ADD CONSTRAINT "client_access_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reproduce exactly today's visibility: whoever entered a client keeps reaching
-- it. Admins are skipped because a grant would be redundant for them, and every
-- grant is whole-client (project_id NULL) because that is what ownership meant.
INSERT INTO "client_access" ("id", "membership_id", "client_id", "project_id", "created_at")
SELECT gen_random_uuid()::text, m."id", c."id", NULL, CURRENT_TIMESTAMP
FROM "client" c
JOIN "membership" m ON m."user_id" = c."owner_id" AND m."org_id" = c."org_id"
WHERE m."role" <> 'ADMIN';
