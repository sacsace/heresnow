export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { seatLoginForbiddenResponse } from "@/lib/requireSeatLogin";
import {
  calendarDayInTz,
  checkInErrorMessage,
  evaluatePunchEligibility,
  isCheckOutPastWindow,
  resolveLateCheckOutTimestamp,
  type LateCheckOutTimeBasis,
} from "@/lib/attendancePunchRules";
import { DEFAULT_COMPANY_TIMEZONE } from "@/lib/companyTimezones";
import { isCheckOutEarly } from "@/lib/companyWorkSchedule";
import { resolveEmployeeWorkSchedule } from "@/lib/employeeWorkSchedule";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const seatDenied = await seatLoginForbiddenResponse(session);
  if (seatDenied) return seatDenied;
  if (!session?.user?.employeeId || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [company, employee] = await Promise.all([
    prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: {
        timezone: true,
        workStartTime: true,
        workEndTime: true,
        workDays: true,
        workScheduleByDay: true,
        shiftPresets: true,
      },
    }),
    prisma.employee.findFirst({
      where: { id: session.user.employeeId, companyId: session.user.companyId },
      select: {
        workScheduleType: true,
        shiftCode: true,
        workStartTime: true,
        workEndTime: true,
        workScheduleByDay: true,
      },
    }),
  ]);
  if (!company || !employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const effectiveSchedule = resolveEmployeeWorkSchedule(employee, company);

  const tz = company.timezone?.trim() || DEFAULT_COMPANY_TIMEZONE;
  const now = new Date();

  const lastRecord = await prisma.attendanceRecord.findFirst({
    where: {
      employeeId: session.user.employeeId,
      companyId: session.user.companyId,
    },
    orderBy: { timestamp: "desc" },
    select: { type: true, timestamp: true },
  });

  const eligibility = evaluatePunchEligibility(
    now,
    tz,
    lastRecord ? { type: lastRecord.type, timestamp: lastRecord.timestamp } : null
  );

  // "지금 퇴근하면 조퇴인가?" — 클라이언트가 사유 입력 UI 를 노출할지 결정
  const earlyLeaveExpected =
    eligibility.canCheckOut &&
    isCheckOutEarly(now, tz, effectiveSchedule);

  /** 출근 후 48시간 초과 — 퇴근은 가능, 기록 시각만 보정 */
  const lateCheckOutPastWindow =
    eligibility.canCheckOut &&
    lastRecord?.type === "CHECK_IN" &&
    isCheckOutPastWindow(lastRecord.timestamp, now);

  let lateCheckOutRecordedAt: string | null = null;
  let lateCheckOutTimeBasis: LateCheckOutTimeBasis | null = null;
  if (lateCheckOutPastWindow && lastRecord?.type === "CHECK_IN") {
    const resolved = resolveLateCheckOutTimestamp(lastRecord.timestamp, tz);
    lateCheckOutRecordedAt = resolved.timestamp.toISOString();
    lateCheckOutTimeBasis = resolved.basis;
  }

  return NextResponse.json({
    ...eligibility,
    checkInMessage: checkInErrorMessage(eligibility.checkInBlock),
    lastType: lastRecord?.type ?? null,
    lastTimestamp: lastRecord?.timestamp.toISOString() ?? null,
    today: calendarDayInTz(now, tz),
    earlyLeaveExpected,
    lateCheckOutPastWindow,
    lateCheckOutRecordedAt,
    lateCheckOutTimeBasis,
    reCheckInApprovalRequired: eligibility.reCheckInApprovalRequired,
    workEndTime: effectiveSchedule.workEndTime ?? company.workEndTime,
  });
}
