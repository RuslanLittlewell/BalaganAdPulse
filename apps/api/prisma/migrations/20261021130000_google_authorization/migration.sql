-- CreateTable
CREATE TABLE "google_authorization" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "integration_id" TEXT,
    "encrypted_refresh_token" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_authorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "google_authorization_expires_at_idx" ON "google_authorization"("expires_at");

-- CreateIndex
CREATE INDEX "google_authorization_project_id_idx" ON "google_authorization"("project_id");

-- AddForeignKey
ALTER TABLE "google_authorization" ADD CONSTRAINT "google_authorization_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
