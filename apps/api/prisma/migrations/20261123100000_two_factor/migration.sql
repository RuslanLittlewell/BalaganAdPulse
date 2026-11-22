ALTER TABLE "organization" ADD COLUMN     "require_two_factor" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "two_factor" (
    "user_id" TEXT NOT NULL,
    "sealed_secret" TEXT,
    "sealed_pending" TEXT,
    "enabled_at" TIMESTAMP(3),
    "last_step" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "two_factor_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "two_factor_backup_code" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_backup_code_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "trusted_address" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "address" VARCHAR(64) NOT NULL,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trusted_address_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "two_factor_challenge" (
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_challenge_pkey" PRIMARY KEY ("token_hash")
);

CREATE UNIQUE INDEX "two_factor_backup_code_code_hash_key" ON "two_factor_backup_code"("code_hash");

CREATE INDEX "two_factor_backup_code_user_id_idx" ON "two_factor_backup_code"("user_id");

CREATE UNIQUE INDEX "trusted_address_user_id_address_key" ON "trusted_address"("user_id", "address");

CREATE INDEX "two_factor_challenge_user_id_idx" ON "two_factor_challenge"("user_id");

ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "two_factor_backup_code" ADD CONSTRAINT "two_factor_backup_code_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trusted_address" ADD CONSTRAINT "trusted_address_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "two_factor_challenge" ADD CONSTRAINT "two_factor_challenge_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

