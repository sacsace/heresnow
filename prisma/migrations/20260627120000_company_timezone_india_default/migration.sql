-- AlterTable: 신규 회사 기본 타임존을 인도 표준시(IST)로 변경
ALTER TABLE "Company" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Kolkata';
