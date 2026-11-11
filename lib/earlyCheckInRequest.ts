import { calendarDayInTz } from "@/lib/attendancePunchRules";
import { acquireAttendanceEmployeeLock } from "@/lib/attendanceLock";
import { DEFAULT_COMPANY_TIMEZONE } from "@/lib/companyTimezones";
import { prisma } from "@/lib/prisma";

/** 해당 근무일에 승인된 이른 출근 요청이 있으면 출입문 출근 시간 제한을 우회한다. */
export async function hasApprovedEarlyCheckIn(params: {
  companyId: string;
  employeeId: string;
  workDate: string;
}): Promise<boolean> {
  const row = await prisma.workRequest.findFirst({
    where: {
      companyId: params.companyId,
      employeeId: params.employeeId,
      type: "EARLY_CHECK_IN",
      status: "APPROVED",
      workDate: params.workDate,
    },
    select: { id: true },
  });
  return Boolean(row);
}

/**
 * 이른 출근 승인 시 출근(CHECK_IN) 기록을 즉시 생성한다.
 * 같은 근무일에 이미 출근이 있으면 건너뛴다.
 */
export async function createCheckInFromEarlyCheckInApproval(params: {
  companyId: string;
  employeeId: string;
  workRequestId: string;
  workDate: string;
  reason?: string | null;
  timestamp?: Date;
}): Promise<{ created: boolean; recordId?: string; skippedReason?: string }> {
  const company = await prisma.company.findUnique({
    where: { id: params.companyId },
    select: { timezone: true },
  });
  const tz = company?.timezone?.trim() || DEFAULT_COMPANY_TIMEZONE;
  const timestamp = params.timestamp ?? new Date();
  const memo = `[EARLY_CHECK_IN] workRequestId=${params.workRequestId}${
    params.reason?.trim() ? ` reason=${params.reason.trim().slice(0, 200)}` : ""
  }`;

  const workDateAnchorMs = Date.parse(`${params.workDate}T12:00:00.000Z`);
  const rangeStart = new Date(workDateAnchorMs - 36 * 60 * 60 * 1000);
  const rangeEnd = new Date(workDateAnchorMs + 36 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    await acquireAttendanceEmployeeLock(tx, params.companyId, params.employeeId);

    const nearbyCheckIns = await tx.attendanceRecord.findMany({
      where: {
        companyId: params.companyId,
        employeeId: params.employeeId,
        type: "CHECK_IN",
        timestamp: { gte: rangeStart, lte: rangeEnd },
      },
      select: { id: true, timestamp: true, recordTimezone: true },
      orderBy: { timestamp: "desc" },
      take: 30,
    });

    const alreadyIn = nearbyCheckIns.some(
      (r) => calendarDayInTz(r.timestamp, r.recordTimezone?.trim() || tz) === params.workDate
    );
    if (alreadyIn) {
      return { created: false, skippedReason: "ALREADY_CHECKED_IN" };
    }

    const latest = await tx.attendanceRecord.findFirst({
      where: { companyId: params.companyId, employeeId: params.employeeId },
      orderBy: { timestamp: "desc" },
      select: { type: true },
    });
    if (latest?.type === "CHECK_IN") {
      return { created: false, skippedReason: "ALREADY_CHECKED_IN" };
    }

    const record = await tx.attendanceRecord.create({
      data: {
        companyId: params.companyId,
        employeeId: params.employeeId,
        type: "CHECK_IN",
        timestamp,
        recordTimezone: tz,
        latitude: 0,
        longitude: 0,
        accuracy: null,
        distanceFromSite: 0,
        outsideGeofence: false,
        status: "APPROVED",
        memo,
        deviceInfo: "EARLY_CHECK_IN_APPROVAL",
        isLate: false,
        isEarlyLeave: false,
        isOvertime: false,
        isHolidayWork: false,
        lateMinutes: 0,
        overtimeMinutes: 0,
      },
      select: { id: true },
    });

    return { created: true, recordId: record.id };
  });
}

export async function findPendingEarlyCheckIn(params: {
  companyId: string;
  employeeId: string;
  workDate: string;
}) {
  return prisma.workRequest.findFirst({
    where: {
      companyId: params.companyId,
      employeeId: params.employeeId,
      type: "EARLY_CHECK_IN",
      status: "PENDING",
      workDate: params.workDate,
    },
    select: { id: true },
  });
}

/** 이른 출근 제한 시각에 보여줄 기존 신청 상태 */
export async function getEarlyCheckInRequestStatus(params: {
  companyId: string;
  employeeId: string;
  workDate: string;
}): Promise<"PENDING" | "APPROVED" | null> {
  const row = await prisma.workRequest.findFirst({
    where: {
      companyId: params.companyId,
      employeeId: params.employeeId,
      type: "EARLY_CHECK_IN",
      status: { in: ["PENDING", "APPROVED"] },
      workDate: params.workDate,
    },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });
  if (row?.status === "PENDING" || row?.status === "APPROVED") return row.status;
  return null;
}

export function workDateInCompanyTz(now: Date, timezone: string): string {
  return calendarDayInTz(now, timezone);
}
