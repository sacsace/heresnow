-- 출퇴근 시점 타임존 고정 (회사 설정 변경 후에도 표시 시각 유지)
ALTER TABLE "AttendanceRecord" ADD COLUMN "recordTimezone" TEXT;

UPDATE "AttendanceRecord" AS ar
SET "recordTimezone" = c."timezone"
FROM "Company" AS c
WHERE ar."companyId" = c."id"
  AND ar."recordTimezone" IS NULL
  AND c."timezone" IS NOT NULL
  AND TRIM(c."timezone") <> '';

UPDATE "AttendanceRecord"
SET "recordTimezone" = 'Asia/Kolkata'
WHERE "recordTimezone" IS NULL OR TRIM("recordTimezone") = '';
