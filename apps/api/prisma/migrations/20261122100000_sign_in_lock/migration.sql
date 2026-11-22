CREATE TABLE "sign_in_lock" (
    "key" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "round" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "reset_required" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sign_in_lock_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "sign_in_lock_updated_at_idx" ON "sign_in_lock"("updated_at");
