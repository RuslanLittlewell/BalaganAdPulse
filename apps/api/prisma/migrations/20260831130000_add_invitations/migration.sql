-- Invitations replace the shared INVITE_CODE. A membership has to come from
-- somewhere, and one secret in the environment cannot say who should be an
-- admin and who a guest; an invitation carries the role it grants.
--
-- Purely additive. Accounts that already exist were given their memberships by
-- the tenancy migration, so nothing here is backfilled and no past registration
-- is invalidated after the fact.

CREATE TABLE "invite" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "role" "role" NOT NULL,
    "email" TEXT,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "used_at" TIMESTAMP(3),
    "used_by_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invite_code_key" ON "invite"("code");
CREATE INDEX "invite_org_id_created_at_idx" ON "invite"("org_id", "created_at" DESC);

ALTER TABLE "invite" ADD CONSTRAINT "invite_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL, not CASCADE, on both: an invitation records how someone joined, so
-- it must outlive both the account that redeemed it and the membership that
-- issued it.
ALTER TABLE "invite" ADD CONSTRAINT "invite_used_by_id_fkey"
    FOREIGN KEY ("used_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invite" ADD CONSTRAINT "invite_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
