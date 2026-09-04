-- How to reach a person, beside their name and email. Nullable because neither
-- is worth refusing an account over, and because every account that exists was
-- created without them.
ALTER TABLE "app_user" ADD COLUMN "phone" TEXT;
ALTER TABLE "app_user" ADD COLUMN "telegram" TEXT;
