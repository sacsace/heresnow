import { prisma } from "@/lib/prisma";
import { DEFAULT_COMPANY_TIMEZONE } from "@/lib/companyTimezones";
import {
  FACE_DESCRIPTOR_LENGTH,
  FACE_IDENTIFY_MIN_GAP_DOOR,
  FACE_MATCH_THRESHOLD_DOOR,
  identifySingleFaceMatch,
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
  lastType: AttendanceType | null;
  lastTimestamp: string | null;
};

export async function getDoorPunchEligibility(
  companyId: string,
  employeeId: string
): Promise<DoorPunchEligibility> {
  const lastRecord = await prisma.attendanceRecord.findFirst({
    where: { companyId, employeeId },
    orderBy: { timestamp: "desc" },
    select: { type: true, timestamp: true },
  });

  const isCheckedIn = lastRecord?.type === "CHECK_IN";

  return {
    isCheckedIn,
    canCheckIn: !isCheckedIn,
    canCheckOut: isCheckedIn,
    lastType: lastRecord?.type ?? null,
    lastTimestamp: lastRecord?.timestamp.toISOString() ?? null,
  };
}

export async function createDoorAttendanceRecord(input: {
  companyId: string;
  employeeId: string;
  type: AttendanceType;
  timestamp?: Date;
}): Promise<{ id: string; type: AttendanceType; timestamp: Date }> {
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { timezone: true },
  });
  const tz = company?.timezone?.trim() || DEFAULT_COMPANY_TIMEZONE;
  const timestamp = input.timestamp ?? new Date();

  const record = await prisma.attendanceRecord.create({
    data: {
      companyId: input.companyId,
      employeeId: input.employeeId,
      type: input.type,
      timestamp,
      recordTimezone: tz,
      latitude: 0,
      longitude: 0,
      accuracy: null,
      distanceFromSite: 0,
      outsideGeofence: false,
      status: "APPROVED",
      memo: null,
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

  return record;
}

export async function matchFaceDoorEmployee(
  probe: number[],
  companyId: string
): Promise<{ id: string; name: string } | null> {
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

  const identified = identifySingleFaceMatch(
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
