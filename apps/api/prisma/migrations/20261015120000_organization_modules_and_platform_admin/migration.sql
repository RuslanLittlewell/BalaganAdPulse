-- CreateEnum
CREATE TYPE "org_module" AS ENUM ('CRM', 'TASKS', 'REPORTS');

-- CreateEnum
CREATE TYPE "org_status" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "app_user" ADD COLUMN     "is_platform_admin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "modules" "org_module"[] DEFAULT ARRAY['CRM', 'TASKS', 'REPORTS']::"org_module"[],
ADD COLUMN     "status" "org_status" NOT NULL DEFAULT 'ACTIVE';
