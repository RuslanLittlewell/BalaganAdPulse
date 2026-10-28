ALTER TABLE "app_user" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "app_user" ADD COLUMN "login" TEXT;
ALTER TABLE "app_user" ADD COLUMN "issued_password" TEXT;
CREATE UNIQUE INDEX "app_user_login_key" ON "app_user"("login");
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_email_or_login" CHECK ("email" IS NOT NULL OR "login" IS NOT NULL);

CREATE TABLE "client_account" (
  "client_id" TEXT NOT NULL,
  "membership_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_account_pkey" PRIMARY KEY ("client_id")
);
CREATE UNIQUE INDEX "client_account_membership_id_key" ON "client_account"("membership_id");
ALTER TABLE "client_account" ADD CONSTRAINT "client_account_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_account" ADD CONSTRAINT "client_account_membership_id_fkey"
  FOREIGN KEY ("membership_id") REFERENCES "membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_event" ALTER COLUMN "actor_email" DROP NOT NULL;
