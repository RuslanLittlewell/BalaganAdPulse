UPDATE "app_user" SET "login" = "login" || '@balagan.pro' WHERE "login" IS NOT NULL AND "login" NOT LIKE '%@%';
