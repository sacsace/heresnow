-- AlterTable
ALTER TABLE "Company" ADD COLUMN "workStartTime" TEXT DEFAULT '09:00';
ALTER TABLE "Company" ADD COLUMN "workEndTime" TEXT DEFAULT '18:00';
ALTER TABLE "Company" ADD COLUMN "workDays" TEXT DEFAULT '1,2,3,4,5';

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN "isOvertime" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttendanceRecord" ADD COLUMN "isHolidayWork" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttendanceRecord" ADD COLUMN "overtimeMinutes" INTEGER NOT NULL DEFAULT 0;
