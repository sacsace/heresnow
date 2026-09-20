export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { applyPendingAutoCheckOutForEmployee } from "@/lib/autoCheckOut";
import { seatLoginForbiddenResponse } from "@/lib/requireSeatLogin";
import {
  calendarDayInTz,
  checkInErrorMessage,
  checkOutErrorMessage,
  evaluatePunchEligibility,
  isCheckOutPastWindow,
  resolveLateCheckOutTimestamp,
  THIRTY_H_MS,
  type LateCheckOutTimeBasis,
} from "@/lib/attendancePunchRules";
import { DEFAULT_COMPANY_TIMEZONE } from "@/lib/companyTimezones";
import { isCheckOutEarly } from "@/lib/companyWorkSchedule";
import { resolveEmployeeWorkSchedule } from "@/lib/employeeWorkSchedule";
import { prisma } from "@/lib/prisma";
import {
  isCheckOutOvertimeApprovalRequired,
  overtimeApplicationEnabled,
  overtimeRequiresApproval,
} from "@/lib/overtimePolicy";
import { subscriptionPunchForbiddenResponse } from "@/lib/requireActiveSubscriptionApi";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const seatDenied = await seatLoginForbiddenResponse(session);
  if (seatDenied) return seatDenied;
  const subscriptionDenied = await subscriptionPunchForbiddenResponse(session?.user?.companyId);
  if (subscriptionDenied) return subscriptionDenied;
  if (!session?.user?.employeeId || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [company, employee] = await Promise.all([
    prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: {
        timezone: true,
        freePunchEnabled: true,
        overtimeMode: true,
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

  await applyPendingAutoCheckOutForEmployee({
    employeeId: session.user.employeeId,
    companyId: session.user.companyId,
    now,
  });
  const freePunchEnabled =
    Boolean(company.freePunchEnabled) && employee.workScheduleType === "FREE";
  const overtimeApprovalRequired = overtimeRequiresApproval({
    overtimeMode: company.overtimeMode,
    freePunchEnabled,
  });

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
    lastRecord ? { type: lastRecord.type, timestamp: lastRecord.timestamp } : null,
    { workSchedule: effectiveSchedule }
  );

  // "지금 퇴근하면 조퇴인가?" — 클라이언트가 사유 입력 UI 를 노출할지 결정
  const earlyLeaveExpected =
    !freePunchEnabled &&
    eligibility.canCheckOut &&
    lastRecord?.type === "CHECK_IN" &&
    isCheckOutEarly(now, lastRecord.timestamp, tz, effectiveSchedule);

  /** 출근 후 48시간 초과 — 퇴근은 가능, 기록 시각만 보정 */
  const lateCheckOutPastWindow =
    eligibility.canCheckOut &&
    lastRecord?.type === "CHECK_IN" &&
    isCheckOutPastWindow(lastRecord.timestamp, now);

  /** 출근 후 30~48시간 — POST 와 동일하게 OT 승인·사유 없음 */
  const staleCheckOutNoOvertime =
    eligibility.canCheckOut &&
    lastRecord?.type === "CHECK_IN" &&
    !lateCheckOutPastWindow &&
    now.getTime() - lastRecord.timestamp.getTime() >= THIRTY_H_MS;

  const overtimeExpected =
    overtimeApprovalRequired &&
    eligibility.canCheckOut &&
    lastRecord?.type === "CHECK_IN" &&
    !earlyLeaveExpected &&
    !lateCheckOutPastWindow &&
    !staleCheckOutNoOvertime &&
    isCheckOutOvertimeApprovalRequired(
      now,
      lastRecord.timestamp,
      tz,
      effectiveSchedule,
      company.overtimeMode,
      freePunchEnabled
    );

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
    checkOutMessage: checkOutErrorMessage(eligibility.checkOutBlock),
    lastType: lastRecord?.type ?? null,
    lastTimestamp: lastRecord?.timestamp.toISOString() ?? null,
    today: calendarDayInTz(now, tz),
    earlyLeaveExpected,
    overtimeExpected,
    lateCheckOutPastWindow,
    lateCheckOutRecordedAt,
    lateCheckOutTimeBasis,
    reCheckInApprovalRequired: freePunchEnabled ? false : eligibility.reCheckInApprovalRequired,
    freePunchEnabled,
    overtimeApprovalRequired,
    overtimeApplicationEnabled: overtimeApplicationEnabled({
      overtimeMode: company.overtimeMode,
      freePunchEnabled,
    }),
    workEndTime: effectiveSchedule.workEndTime ?? company.workEndTime,
  });
}
