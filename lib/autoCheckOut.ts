import { TWENTY_FOUR_H_MS } from "@/lib/attendancePunchRules";
import { calendarDayInTz } from "@/lib/adminMonthlyAttendance";
import { AUTO_CHECKOUT_MEMO } from "@/lib/autoCheckOutDisplay";
import { type CompanyWorkSchedule, scheduledShiftEndAt } from "@/lib/companyWorkSchedule";
import { resolveEmployeeWorkSchedule } from "@/lib/employeeWorkSchedule";
import { acquireAttendanceEmployeeLock } from "@/lib/attendanceLock";
import { enqueueMvsAttendanceIfEnabled } from "@/lib/integrations/enqueueMvsAttendance";
import { evaluateCheckoutOvertimeFlags } from "@/lib/overtimePolicy";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";

export { AUTO_CHECKOUT_MEMO, formatCheckOutDisplay, isAutoCheckOutMemo } from "@/lib/autoCheckOutDisplay";

/**
 * 출근 시각·근무표 기준 정규 퇴근 시각.
 * scheduledShiftEndAt 이 없으면 출근일 workEndTime(기본 18:00)을 사용한다.
 */
export function resolveAutoCheckOutTimestamp(
  checkInAt: Date,
  timeZone: string,
  schedule: CompanyWorkSchedule
): Date {
  const scheduled = scheduledShiftEndAt(checkInAt, timeZone, schedule);
  if (scheduled && scheduled.getTime() > checkInAt.getTime()) {
    return scheduled;
  }

  const tz = timeZone.trim() || "UTC";
  const checkInDay = calendarDayInTz(checkInAt, tz);
  const endTime = schedule.workEndTime?.trim() || "18:00";
  try {
    const fallback = fromZonedTime(`${checkInDay} ${endTime}:00`, tz);
    if (fallback.getTime() > checkInAt.getTime()) return fallback;
  } catch {
    /* fall through */
  }

  return new Date(checkInAt.getTime() + 8 * 60 * 60 * 1000);
}

type ApplyAutoCheckOutParams = {
  employeeId: string;
  companyId: string;
  now?: Date;
  overtimeMode?: string | null;
  freePunchEnabled?: boolean;
};

type OpenCheckInRecord = {
  id: string;
  timestamp: Date;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  distanceFromSite: number;
  outsideGeofence: boolean;
  siteId: string | null;
  recordTimezone: string | null;
  isBusinessTrip: boolean;
};

async function createAutoCheckOutRecord(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    employeeId: string;
    checkIn: OpenCheckInRecord;
    checkoutAt: Date;
    timeZone: string;
    schedule: CompanyWorkSchedule;
    overtimeMode: string | null;
    freePunchEnabled: boolean;
  }
): Promise<string | null> {
  const {
    companyId,
    employeeId,
    checkIn,
    checkoutAt,
    timeZone,
    schedule,
    overtimeMode,
    freePunchEnabled,
  } = params;

  const workFlags = evaluateCheckoutOvertimeFlags({
    checkOutAt: checkoutAt,
    checkInAt: checkIn.timestamp,
    timeZone,
    schedule,
    overtimeMode,
    freePunchEnabled,
  });

  const record = await tx.attendanceRecord.create({
    data: {
      company: { connect: { id: companyId } },
      employee: { connect: { id: employeeId } },
      ...(checkIn.siteId ? { site: { connect: { id: checkIn.siteId } } } : {}),
      type: "CHECK_OUT",
      timestamp: checkoutAt,
      latitude: checkIn.latitude,
      longitude: checkIn.longitude,
      accuracy: checkIn.accuracy,
      distanceFromSite: checkIn.distanceFromSite,
      outsideGeofence: checkIn.outsideGeofence,
      status: "APPROVED",
      memo: AUTO_CHECKOUT_MEMO,
      isBusinessTrip: false,
      isLate: false,
      isEarlyLeave: workFlags.isEarlyLeave,
      isOvertime: workFlags.isOvertime,
      isHolidayWork: workFlags.isHolidayWork,
      lateMinutes: 0,
      overtimeMinutes: workFlags.overtimeMinutes,
      recordTimezone: checkIn.recordTimezone ?? timeZone,
      deviceInfo: "auto-checkout",
    },
    select: { id: true },
  });

  return record.id;
}

/** 미퇴근 출근이 24시간 이상 지속되면 정규 퇴근 시각으로 CHECK_OUT 을 생성한다. */
export async function applyPendingAutoCheckOutForEmployee(
  params: ApplyAutoCheckOutParams
): Promise<string | null> {
  const { employeeId, companyId, now = new Date() } = params;

  const [company, employee, lastRecord] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
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
      where: { id: employeeId, companyId },
      select: {
        workScheduleType: true,
        shiftCode: true,
        workStartTime: true,
        workEndTime: true,
        workScheduleByDay: true,
      },
    }),
    prisma.attendanceRecord.findFirst({
      where: { employeeId, companyId },
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        type: true,
        timestamp: true,
        latitude: true,
        longitude: true,
        accuracy: true,
        distanceFromSite: true,
        outsideGeofence: true,
        siteId: true,
        recordTimezone: true,
        isBusinessTrip: true,
      },
    }),
  ]);

  if (!company || !employee || !lastRecord || lastRecord.type !== "CHECK_IN") {
    return null;
  }

  if (now.getTime() - lastRecord.timestamp.getTime() < TWENTY_FOUR_H_MS) {
    return null;
  }

  const tz = company.timezone?.trim() || "UTC";
  const schedule = resolveEmployeeWorkSchedule(employee, company);
  const checkoutAt = resolveAutoCheckOutTimestamp(lastRecord.timestamp, tz, schedule);
  const freePunchEnabled =
    Boolean(company.freePunchEnabled) && employee.workScheduleType === "FREE";

  let createdId: string | null = null;
  await prisma.$transaction(async (tx) => {
    await acquireAttendanceEmployeeLock(tx, companyId, employeeId);
    const latest = await tx.attendanceRecord.findFirst({
      where: { employeeId, companyId },
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        type: true,
        timestamp: true,
        latitude: true,
        longitude: true,
        accuracy: true,
        distanceFromSite: true,
        outsideGeofence: true,
        siteId: true,
        recordTimezone: true,
        isBusinessTrip: true,
      },
    });

    if (!latest || latest.type !== "CHECK_IN" || latest.id !== lastRecord.id) {
      return;
    }
    if (now.getTime() - latest.timestamp.getTime() < TWENTY_FOUR_H_MS) {
      return;
    }

    createdId = await createAutoCheckOutRecord(tx, {
      companyId,
      employeeId,
      checkIn: latest,
      checkoutAt,
      timeZone: tz,
      schedule,
      overtimeMode: company.overtimeMode,
      freePunchEnabled,
    });
  });

  if (createdId) {
    void enqueueMvsAttendanceIfEnabled(createdId, false);
  }

  return createdId;
}

/** 회사 전체 — 마지막 기록이 CHECK_IN 인 직원에 대해 자동 퇴근을 적용한다. */
export async function applyPendingAutoCheckOutsForCompany(
  companyId: string,
  now = new Date()
): Promise<number> {
  const latestByEmployee = await prisma.attendanceRecord.findMany({
    where: { companyId },
    orderBy: { timestamp: "desc" },
    distinct: ["employeeId"],
    select: { employeeId: true, type: true },
  });

  let count = 0;
  for (const row of latestByEmployee) {
    if (row.type !== "CHECK_IN") continue;
    const id = await applyPendingAutoCheckOutForEmployee({
      employeeId: row.employeeId,
      companyId,
      now,
    });
    if (id) count += 1;
  }
  return count;
}
