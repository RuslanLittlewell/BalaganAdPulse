-- CreateEnum
CREATE TYPE "tariff" AS ENUM ('TRIAL', 'SOLO', 'BUSINESS', 'AGENCY', 'AGENCY_PRO', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN "tariff" "tariff" NOT NULL DEFAULT 'ENTERPRISE',
ADD COLUMN "trial_ends_at" TIMESTAMP(3);

ALTER TABLE "organization" ALTER COLUMN "tariff" SET DEFAULT 'TRIAL';

ALTER TABLE "organization" DROP COLUMN "modules";

-- DropEnum
DROP TYPE "org_module";
