-- CreateTable
CREATE TABLE "telegram_link" (
    "membership_id" TEXT NOT NULL,
    "chat_id" BIGINT NOT NULL,
    "username" TEXT,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_link_pkey" PRIMARY KEY ("membership_id")
);

-- CreateTable
CREATE TABLE "telegram_link_token" (
    "membership_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_link_token_pkey" PRIMARY KEY ("membership_id")
);

-- CreateTable
CREATE TABLE "telegram_task_draft" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "chat_id" BIGINT NOT NULL,
    "draft" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_task_draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_link_chat_id_key" ON "telegram_link"("chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_link_token_token_hash_key" ON "telegram_link_token"("token_hash");

-- CreateIndex
CREATE INDEX "telegram_task_draft_created_at_idx" ON "telegram_task_draft"("created_at");

-- AddForeignKey
ALTER TABLE "telegram_link" ADD CONSTRAINT "telegram_link_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_link_token" ADD CONSTRAINT "telegram_link_token_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_task_draft" ADD CONSTRAINT "telegram_task_draft_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

