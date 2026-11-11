-- AlterTable
ALTER TABLE "Department" ADD COLUMN "workScheduleMode" TEXT NOT NULL DEFAULT 'COMPANY';
ALTER TABLE "Department" ADD COLUMN "shiftCode" TEXT;
ALTER TABLE "Department" ADD COLUMN "workStartTime" TEXT;
ALTER TABLE "Department" ADD COLUMN "workEndTime" TEXT;
