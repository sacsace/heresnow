-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN "isBusinessTrip" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttendanceRecord" ADD COLUMN "businessTripLocation" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN "businessTripReason" TEXT;
