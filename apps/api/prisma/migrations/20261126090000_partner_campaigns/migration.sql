CREATE TABLE "partner_campaign" (
    "membership_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,

    CONSTRAINT "partner_campaign_pkey" PRIMARY KEY ("membership_id","campaign_id")
);

CREATE TABLE "invite_campaign" (
    "invite_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,

    CONSTRAINT "invite_campaign_pkey" PRIMARY KEY ("invite_id","campaign_id")
);

CREATE INDEX "partner_campaign_campaign_id_idx" ON "partner_campaign"("campaign_id");

CREATE INDEX "invite_campaign_campaign_id_idx" ON "invite_campaign"("campaign_id");

ALTER TABLE "partner_campaign" ADD CONSTRAINT "partner_campaign_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "partner_campaign" ADD CONSTRAINT "partner_campaign_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invite_campaign" ADD CONSTRAINT "invite_campaign_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "invite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invite_campaign" ADD CONSTRAINT "invite_campaign_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "partner_campaign" ("membership_id", "campaign_id")
SELECT "id", "campaign_id" FROM "membership" WHERE "campaign_id" IS NOT NULL;

INSERT INTO "invite_campaign" ("invite_id", "campaign_id")
SELECT "id", "campaign_id" FROM "invite" WHERE "campaign_id" IS NOT NULL;

ALTER TABLE "membership" DROP CONSTRAINT "membership_campaign_id_fkey";

ALTER TABLE "invite" DROP CONSTRAINT "invite_campaign_id_fkey";

DROP INDEX "membership_campaign_id_idx";

DROP INDEX "invite_campaign_id_idx";

ALTER TABLE "membership" DROP COLUMN "campaign_id";

ALTER TABLE "invite" DROP COLUMN "campaign_id";
