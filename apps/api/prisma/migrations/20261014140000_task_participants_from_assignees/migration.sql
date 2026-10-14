INSERT INTO "task_participant" ("task_id", "membership_id")
SELECT "id", "assignee_id" FROM "task" WHERE "assignee_id" IS NOT NULL
ON CONFLICT DO NOTHING;
