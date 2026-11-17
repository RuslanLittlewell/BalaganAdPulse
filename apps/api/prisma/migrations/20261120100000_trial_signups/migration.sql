CREATE TABLE "trial_signup" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organization_name" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trial_signup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trial_signup_email_key" ON "trial_signup"("email");

CREATE UNIQUE INDEX "trial_signup_token_hash_key" ON "trial_signup"("token_hash");
