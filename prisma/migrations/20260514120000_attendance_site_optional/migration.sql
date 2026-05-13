-- AlterTable: 출퇴근을 근무지 없이 GPS만으로 기록 가능
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT "AttendanceRecord_siteId_fkey";

ALTER TABLE "AttendanceRecord" ALTER COLUMN "siteId" DROP NOT NULL;

ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
