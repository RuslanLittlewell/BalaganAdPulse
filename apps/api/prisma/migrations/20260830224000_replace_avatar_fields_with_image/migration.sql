ALTER TABLE "app_user" RENAME COLUMN "avatar_key" TO "image";
ALTER TABLE "app_user" DROP COLUMN "avatar_revision";
