-- 지각 분(lateMinutes) — 정시 출근 시각 대비 늦은 분. 휴일/조기 출근 시 0
ALTER TABLE "AttendanceRecord" ADD COLUMN "lateMinutes" INTEGER NOT NULL DEFAULT 0;
