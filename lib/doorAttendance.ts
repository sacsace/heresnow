import { prisma } from "@/lib/prisma";
import { DEFAULT_COMPANY_TIMEZONE } from "@/lib/companyTimezones";
import {
  capCheckOutTimestamp,
  evaluatePunchEligibility,
  formatLateCheckOutBasisLabel,
  isCheckOutPastWindow,
  resolveLateCheckOutTimestamp,
} from "@/lib/attendancePunchRules";
import { acquireAttendanceEmployeeLock } from "@/lib/attendanceLock";
import {
  FACE_DESCRIPTOR_LENGTH,
  FACE_IDENTIFY_MIN_GAP_DOOR,
  FACE_MATCH_THRESHOLD_DOOR,
  identifySingleFaceMatchParsed,
  parseFaceDescriptor,
} from "@/lib/faceMatch";
import type { AttendanceType, Role } from "@prisma/client";

/** 출입문 단말에서 출퇴근 기록 가능한 역할 */
export const DOOR_PUNCHABLE_ROLES: Role[] = ["EMPLOYEE", "APPROVER"];

export function isDoorRole(role: Role | string | null | undefined): boolean {
  return role === "DOOR";
}

export type DoorPunchEligibility = {
  isCheckedIn: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  checkInBlock: "ALREADY_CHECKED_IN" | "COOLDOWN" | null;
  checkOutBlock: "NOT_CHECKED_IN" | "MIN_INTERVAL" | null;
  nextCheckInAt: string | null;
  nextCheckOutAt: string | null;
  lastType: AttendanceType | null;
  lastTimestamp: string | null;
};

type CachedDoorEmployee = {
  id: string;
  name: string;
  descriptor: number[];
};

const DOOR_FACE_CACHE_TTL_MS = 60_000;
const doorEmployeeCache = new Map<
  string,
  { expiresAt: number; employees: CachedDoorEmployee[] }
>();

async function getDoorEmployeesForMatch(companyId: string): Promise<CachedDoorEmployee[]> {
  const now = Date.now();
  const cached = doorEmployeeCache.get(companyId);
  if (cached && cached.expiresAt > now) {
    return cached.employees;
  }

  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      faceEnrolledAt: { not: null },
      user: { role: { in: DOOR_PUNCHABLE_ROLES } },
    },
    select: {
      id: true,
      name: true,
      faceDescriptor: true,
    },
  });

  const normalizedEmployees = employees
    .map((employee) => {
      const descriptor = parseFaceDescriptor(employee.faceDescriptor);
      if (!descriptor) return null;
      return {
        id: employee.id,
        name: employee.name,
        descriptor,
      };
    })
    .filter((employee): employee is CachedDoorEmployee => Boolean(employee));

  doorEmployeeCache.set(companyId, {
    expiresAt: now + DOOR_FACE_CACHE_TTL_MS,
    employees: normalizedEmployees,
  });
  return normalizedEmployees;
}

export async function getDoorPunchEligibility(
  companyId: string,
  employeeId: string
): Promise<DoorPunchEligibility> {
  const [company, lastRecord] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    }),
    prisma.attendanceRecord.findFirst({
      where: { companyId, employeeId },
      orderBy: { timestamp: "desc" },
      select: { type: true, timestamp: true },
    }),
  ]);
  const tz = company?.timezone?.trim() || DEFAULT_COMPANY_TIMEZONE;
  const eligibility = evaluatePunchEligibility(
    new Date(),
    tz,
    lastRecord ? { type: lastRecord.type, timestamp: lastRecord.timestamp } : null
  );

  return {
    isCheckedIn: eligibility.isCheckedIn,
    canCheckIn: eligibility.canCheckIn,
    canCheckOut: eligibility.canCheckOut,
    checkInBlock: eligibility.checkInBlock,
    checkOutBlock: eligibility.checkOutBlock,
    nextCheckInAt: eligibility.nextCheckInAt,
    nextCheckOutAt: eligibility.nextCheckOutAt,
    lastType: lastRecord?.type ?? null,
    lastTimestamp: lastRecord?.timestamp.toISOString() ?? null,
  };
}

export async function createDoorAttendanceRecord(input: {
  companyId: string;
  employeeId: string;
  type: AttendanceType;
  timestamp?: Date;
  expectedLastType?: AttendanceType | null;
  expectedLastTimestamp?: string | null;
}): Promise<{ id: string; type: AttendanceType; timestamp: Date }> {
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { timezone: true },
  });
  const tz = company?.timezone?.trim() || DEFAULT_COMPANY_TIMEZONE;
  const timestamp = input.timestamp ?? new Date();
  const expectedLastTsMs = input.expectedLastTimestamp
    ? new Date(input.expectedLastTimestamp).getTime()
    : null;

  const record = await prisma.$transaction(async (tx) => {
    await acquireAttendanceEmployeeLock(tx, input.companyId, input.employeeId);
    const latest = await tx.attendanceRecord.findFirst({
      where: { companyId: input.companyId, employeeId: input.employeeId },
      orderBy: { timestamp: "desc" },
      select: { type: true, timestamp: true },
    });

    const latestType = latest?.type ?? null;
    const latestTsMs = latest?.timestamp.getTime() ?? null;
    if (latestType !== (input.expectedLastType ?? null) || latestTsMs !== expectedLastTsMs) {
      throw { code: "PUNCH_STATE_CHANGED" } as const;
    }

    const eligibility = evaluatePunchEligibility(
      timestamp,
      tz,
      latest ? { type: latest.type, timestamp: latest.timestamp } : null
    );
    if (input.type === "CHECK_IN" && !eligibility.canCheckIn) {
      throw { code: "CHECK_IN_BLOCKED" } as const;
    }
    if (input.type === "CHECK_OUT" && !eligibility.canCheckOut) {
      throw { code: "CHECK_OUT_BLOCKED" } as const;
    }

    let recordTimestamp = timestamp;
    let memo: string | null = null;
    if (input.type === "CHECK_OUT" && latest?.type === "CHECK_IN") {
      if (isCheckOutPastWindow(latest.timestamp, timestamp)) {
        const resolved = resolveLateCheckOutTimestamp(latest.timestamp, tz);
        recordTimestamp = resolved.timestamp;
        memo = `[SYSTEM_CORRECTION] reason=STALE_CHECK_IN actualRequestedAt=${timestamp.toISOString()} correctedRecordedAt=${recordTimestamp.toISOString()} basis=${formatLateCheckOutBasisLabel(resolved.basis, "en")}`;
      } else {
        const capped = capCheckOutTimestamp(latest.timestamp, timestamp);
        recordTimestamp = capped.timestamp;
        if (capped.capped) {
          memo = `[SYSTEM_CORRECTION] reason=MAX_SHIFT_WORK_21H actualRequestedAt=${timestamp.toISOString()} correctedRecordedAt=${recordTimestamp.toISOString()}`;
        }
      }
    }

    return tx.attendanceRecord.create({
      data: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        type: input.type,
        timestamp: recordTimestamp,
        recordTimezone: tz,
        latitude: 0,
        longitude: 0,
        accuracy: null,
        distanceFromSite: 0,
        outsideGeofence: false,
        status: "APPROVED",
        memo,
        deviceInfo: "DOOR_TERMINAL",
        isLate: false,
        isEarlyLeave: false,
        isOvertime: false,
        isHolidayWork: false,
        lateMinutes: 0,
        overtimeMinutes: 0,
      },
      select: { id: true, type: true, timestamp: true },
    });
  });

  return record;
}

export async function matchFaceDoorEmployee(
  probe: number[],
  companyId: string
): Promise<{ id: string; name: string } | null> {
  const employees = await getDoorEmployeesForMatch(companyId);

  const identified = identifySingleFaceMatchParsed(
    employees,
    probe,
    FACE_MATCH_THRESHOLD_DOOR,
    FACE_IDENTIFY_MIN_GAP_DOOR
  );
  if (!identified) return null;
  return { id: identified.match.id, name: identified.match.name };
}

export function parseDoorFaceDescriptor(raw: unknown): number[] | null {
  if (Array.isArray(raw)) {
    return parseFaceDescriptor(raw);
  }
  return null;
}

export { FACE_DESCRIPTOR_LENGTH };
