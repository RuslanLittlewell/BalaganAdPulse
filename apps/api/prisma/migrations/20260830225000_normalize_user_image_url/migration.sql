UPDATE "app_user"
SET "image" = '/api/user/avatar'
WHERE "image" IS NOT NULL;
