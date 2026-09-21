UPDATE "lead" AS target
SET "position" = ranked."rank"
FROM (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "org_id", "client_id", COALESCE("stage"::text, "column_id")
    ORDER BY "created_at" DESC, "id"
  ) - 1 AS "rank"
  FROM "lead"
) AS ranked
WHERE target."id" = ranked."id";
