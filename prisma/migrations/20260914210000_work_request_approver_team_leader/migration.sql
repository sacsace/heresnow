-- 팀장 지정 · 승인권자 · 동일 날짜 중복 신청 방지

-- 기존 중복(같은 직원·종류·근무일)은 최신 건만 유지
DELETE FROM "WorkRequest" w1
USING "WorkRequest" w2
WHERE w1."employeeId" = w2."employeeId"
  AND w1."type" = w2."type"
  AND w1."workDate" = w2."workDate"
  AND w1."createdAt" < w2."createdAt";

ALTER TABLE "Employee" ADD COLUMN "isTeamLeader" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "WorkRequest" ADD COLUMN "assignedApproverUserId" TEXT;

ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_assignedApproverUserId_fkey"
  FOREIGN KEY ("assignedApproverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "WorkRequest_employeeId_type_workDate_key"
  ON "WorkRequest"("employeeId", "type", "workDate");

CREATE INDEX "WorkRequest_assignedApproverUserId_idx"
  ON "WorkRequest"("assignedApproverUserId");
