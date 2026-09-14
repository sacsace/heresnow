-- CreateEnum
CREATE TYPE "OvertimeMode" AS ENUM ('AUTO', 'AFTER_APPROVAL');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "overtimeMode" "OvertimeMode" NOT NULL DEFAULT 'AUTO';
