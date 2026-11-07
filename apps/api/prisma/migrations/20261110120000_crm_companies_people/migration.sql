-- CreateTable
CREATE TABLE "crm_company" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "website" VARCHAR(2048),
    "phone" VARCHAR(50),
    "notes" VARCHAR(10000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_person" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(50),
    "phone_digits" VARCHAR(50) GENERATED ALWAYS AS (NULLIF(regexp_replace(coalesce("phone", ''), '\D', '', 'g'), '')) STORED,
    "email" VARCHAR(254),
    "telegram" VARCHAR(100),
    "messenger" VARCHAR(100),
    "company_id" TEXT,
    "notes" VARCHAR(10000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_person_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_company_client_id_name_idx" ON "crm_company"("client_id", "name");

-- CreateIndex
CREATE INDEX "crm_person_client_id_name_idx" ON "crm_person"("client_id", "name");

-- CreateIndex
CREATE INDEX "crm_person_client_id_phone_digits_idx" ON "crm_person"("client_id", "phone_digits");

-- CreateIndex
CREATE INDEX "crm_person_client_id_email_idx" ON "crm_person"("client_id", lower("email"));

-- AddForeignKey
ALTER TABLE "crm_company" ADD CONSTRAINT "crm_company_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_company" ADD CONSTRAINT "crm_company_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_person" ADD CONSTRAINT "crm_person_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_person" ADD CONSTRAINT "crm_person_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_person" ADD CONSTRAINT "crm_person_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "lead" ADD COLUMN "company_id" TEXT,
ADD COLUMN "person_id" TEXT;

-- MoveData
CREATE TEMPORARY TABLE "lead_contact" AS
SELECT
    l."id" AS "lead_id",
    l."org_id",
    p."client_id",
    l."name",
    NULLIF(trim(l."phone"), '') AS "phone",
    NULLIF(trim(l."email"), '') AS "email",
    NULLIF(trim(l."telegram"), '') AS "telegram",
    NULLIF(trim(l."messenger"), '') AS "messenger",
    NULLIF(trim(l."company"), '') AS "company_name",
    NULLIF(trim(l."website"), '') AS "website",
    l."created_at",
    CASE
        WHEN NULLIF(trim(l."email"), '') IS NOT NULL THEN 'e:' || lower(trim(l."email"))
        WHEN NULLIF(regexp_replace(coalesce(l."phone", ''), '\D', '', 'g'), '') IS NOT NULL THEN 'p:' || regexp_replace(l."phone", '\D', '', 'g')
        ELSE 'l:' || l."id"
    END AS "contact_key",
    CASE
        WHEN NULLIF(trim(l."company"), '') IS NOT NULL THEN 'n:' || lower(trim(l."company"))
        WHEN NULLIF(trim(l."website"), '') IS NOT NULL THEN 'h:' || lower(substring(trim(l."website") from '^(?:[a-zA-Z][a-zA-Z0-9+.-]*://)?(?:www\.)?([^/:?#]+)'))
        ELSE NULL
    END AS "company_key"
FROM "lead" l
JOIN "project" p ON p."id" = l."project_id";

-- MoveData
CREATE TEMPORARY TABLE "company_map" AS
SELECT DISTINCT ON (c."client_id", c."company_key")
    c."client_id",
    c."company_key",
    gen_random_uuid()::text AS "id",
    c."org_id",
    left(coalesce(c."company_name", substring(c."company_key" from 3)), 200) AS "name",
    (
        SELECT w."website" FROM "lead_contact" w
        WHERE w."client_id" = c."client_id" AND w."company_key" = c."company_key" AND w."website" IS NOT NULL
        ORDER BY w."created_at" DESC LIMIT 1
    ) AS "website"
FROM "lead_contact" c
WHERE c."company_key" IS NOT NULL
ORDER BY c."client_id", c."company_key", c."created_at" DESC;

-- MoveData
INSERT INTO "crm_company" ("id", "org_id", "client_id", "name", "website", "created_at", "updated_at")
SELECT "id", "org_id", "client_id", "name", "website", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "company_map";

-- MoveData
CREATE TEMPORARY TABLE "person_map" AS
SELECT DISTINCT ON (c."client_id", c."contact_key")
    c."client_id",
    c."contact_key",
    gen_random_uuid()::text AS "id",
    c."org_id",
    c."name",
    c."phone",
    c."email",
    c."telegram",
    c."messenger",
    c."company_key"
FROM "lead_contact" c
ORDER BY c."client_id", c."contact_key", c."created_at" DESC;

-- MoveData
INSERT INTO "crm_person" ("id", "org_id", "client_id", "name", "phone", "email", "telegram", "messenger", "company_id", "created_at", "updated_at")
SELECT pm."id", pm."org_id", pm."client_id", pm."name", pm."phone",
    pm."email", pm."telegram", pm."messenger", cm."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "person_map" pm
LEFT JOIN "company_map" cm ON cm."client_id" = pm."client_id" AND cm."company_key" = pm."company_key";

-- MoveData
UPDATE "lead" l SET "person_id" = pm."id"
FROM "lead_contact" lc
JOIN "person_map" pm ON pm."client_id" = lc."client_id" AND pm."contact_key" = lc."contact_key"
WHERE l."id" = lc."lead_id";

-- MoveData
UPDATE "lead" l SET "company_id" = cm."id"
FROM "lead_contact" lc
JOIN "company_map" cm ON cm."client_id" = lc."client_id" AND cm."company_key" = lc."company_key"
WHERE l."id" = lc."lead_id";

-- MoveData
DROP TABLE "lead_contact";

-- MoveData
DROP TABLE "company_map";

-- MoveData
DROP TABLE "person_map";

-- AlterTable
ALTER TABLE "lead" DROP COLUMN "company",
DROP COLUMN "email",
DROP COLUMN "messenger",
DROP COLUMN "phone",
DROP COLUMN "telegram",
DROP COLUMN "website";

-- CreateIndex
CREATE INDEX "lead_person_id_idx" ON "lead"("person_id");

-- CreateIndex
CREATE INDEX "lead_company_id_idx" ON "lead"("company_id");

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "crm_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
