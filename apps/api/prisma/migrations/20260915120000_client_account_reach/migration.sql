INSERT INTO "client_access" ("id", "membership_id", "client_id", "project_id", "created_at")
SELECT gen_random_uuid()::text, grants."membership_id", grants."client_id", NULL, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT access."membership_id", access."client_id"
  FROM "client_access" access
  JOIN "membership" member ON member."id" = access."membership_id"
  WHERE member."role" IN ('CLIENT', 'CLIENT_ADMIN') AND access."project_id" IS NOT NULL
) grants
WHERE NOT EXISTS (
  SELECT 1 FROM "client_access" whole
  WHERE whole."membership_id" = grants."membership_id"
    AND whole."client_id" = grants."client_id"
    AND whole."project_id" IS NULL
);

DELETE FROM "client_access" access
USING "membership" member
WHERE member."id" = access."membership_id"
  AND member."role" IN ('CLIENT', 'CLIENT_ADMIN')
  AND access."project_id" IS NOT NULL;

UPDATE "membership" member
SET "role" = 'CLIENT_ADMIN'
FROM "invite" invitation
WHERE invitation."used_by_id" = member."user_id"
  AND invitation."org_id" = member."org_id"
  AND invitation."registration_type" = 'CLIENT'
  AND member."role" = 'CLIENT';
