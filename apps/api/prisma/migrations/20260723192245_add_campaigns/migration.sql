-- CreateEnum
CREATE TYPE "property_type" AS ENUM ('NUMBER', 'MONEY', 'PERCENT', 'TEXT');

-- CreateTable
CREATE TABLE "campaign" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_property" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT,
    "type" "property_type" NOT NULL,
    "formula" JSONB,
    "position" INTEGER NOT NULL,

    CONSTRAINT "campaign_property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_record" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "campaign_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_property_value" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "number_value" DECIMAL(18,4),
    "text_value" TEXT,

    CONSTRAINT "campaign_property_value_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_client_id_position_idx" ON "campaign"("client_id", "position");

-- CreateIndex
CREATE INDEX "campaign_property_campaign_id_position_idx" ON "campaign_property"("campaign_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_record_campaign_id_date_key" ON "campaign_record"("campaign_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_property_value_record_id_property_id_key" ON "campaign_property_value"("record_id", "property_id");

-- AddForeignKey
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_property" ADD CONSTRAINT "campaign_property_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_record" ADD CONSTRAINT "campaign_record_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_property_value" ADD CONSTRAINT "campaign_property_value_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "campaign_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_property_value" ADD CONSTRAINT "campaign_property_value_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "campaign_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
