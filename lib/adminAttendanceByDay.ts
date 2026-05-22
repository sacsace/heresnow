import { calendarDayInTz, timeInTz } from "@/lib/adminMonthlyAttendance";
import type { AttendanceStatus, AttendanceType } from "@prisma/client";

export type AttendancePunchSummary = {
  id: string;
  timestamp: string;
  time: string;
  latitude: number;
  longitude: number;
  distanceFromSite: number;
  status: AttendanceStatus;
  isLate: boolean;
  isEarlyLeave: boolean;
  isOvertime: boolean;
  isHolidayWork: boolean;
  overtimeMinutes: number;
  isBusinessTrip: boolean;
  businessTripLocation: string | null;
  businessTripReason: string | null;
  memo: string | null;
  site: { name: string } | null;
};

export type AdminAttendanceDayRow = {
  id: string;
  date: string;
  employeeId: string;
  employeeName: string;
  checkIn: AttendancePunchSummary | null;
  checkOut: AttendancePunchSummary | null;
  incomplete: boolean;
  pending: boolean;
  status: AttendanceStatus | "MIXED";
  isLate: boolean;
  isEarlyLeave: boolean;
  isOvertime: boolean;
  isHolidayWork: boolean;
  overtimeMinutes: number;
};

type RecordInput = {
  id: string;
  employeeId: string;
  type: AttendanceType;
  timestamp: Date;
  latitude: number;
  longitude: number;
  distanceFromSite: number;
  status: AttendanceStatus;
  isLate: boolean;
  isEarlyLeave: boolean;
  isOvertime: boolean;
  isHolidayWork: boolean;
  overtimeMinutes: number;
  memo: string | null;
  isBusinessTrip: boolean;
  businessTripLocation: string | null;
  businessTripReason: string | null;
  employee: { name: string };
  site: { name: string } | null;
};

function toPunchSummary(r: RecordInput, timeZone: string): AttendancePunchSummary {
  return {
    id: r.id,
    timestamp: r.timestamp.toISOString(),
    time: timeInTz(r.timestamp, timeZone),
    latitude: r.latitude,
    longitude: r.longitude,
    distanceFromSite: r.distanceFromSite,
    status: r.status,
    isLate: r.isLate,
    isEarlyLeave: r.isEarlyLeave,
    isOvertime: r.isOvertime,
    isHolidayWork: r.isHolidayWork,
    overtimeMinutes: r.overtimeMinutes,
    isBusinessTrip: r.isBusinessTrip,
    businessTripLocation: r.businessTripLocation,
    businessTripReason: r.businessTripReason,
    memo: r.memo,
    site: r.site,
  };
}

function pickEarlier(
  current: AttendancePunchSummary | null,
  next: AttendancePunchSummary
): AttendancePunchSummary {
  if (!current) return next;
  return next.time < current.time ? next : current;
}

function pickLater(
  current: AttendancePunchSummary | null,
  next: AttendancePunchSummary
): AttendancePunchSummary {
  if (!current) return next;
  return next.time > current.time ? next : current;
}

function dayStatus(
  checkIn: AttendancePunchSummary | null,
  checkOut: AttendancePunchSummary | null
): AttendanceStatus | "MIXED" {
  const statuses = new Set<AttendanceStatus>();
  if (checkIn) statuses.add(checkIn.status);
  if (checkOut) statuses.add(checkOut.status);
  if (statuses.size === 0) return "APPROVED";
  if (statuses.size === 1) return [...statuses][0]!;
  if (statuses.has("REJECTED")) return "REJECTED";
  if (statuses.has("PENDING")) return "PENDING";
  return "MIXED";
}

function matchesStatusFilter(
  row: AdminAttendanceDayRow,
  statusFilter: string | undefined
): boolean {
  if (!statusFilter) return true;
  if (row.status === statusFilter) return true;
  if (row.checkIn?.status === statusFilter) return true;
  if (row.checkOut?.status === statusFilter) return true;
  return false;
}

export function aggregateAttendanceByDay(
  records: RecordInput[],
  timeZone: string,
  statusFilter?: string
): AdminAttendanceDayRow[] {
  const tz = timeZone.trim() || "UTC";
  const byKey = new Map<
    string,
    {
      date: string;
      employeeId: string;
      employeeName: string;
      checkIn: AttendancePunchSummary | null;
      checkOut: AttendancePunchSummary | null;
      pending: boolean;
    }
  >();

  for (const r of records) {
    const day = calendarDayInTz(r.timestamp, tz);
    const key = `${r.employeeId}:${day}`;
    let cell = byKey.get(key);
    if (!cell) {
      cell = {
        date: day,
        employeeId: r.employeeId,
        employeeName: r.employee.name,
        checkIn: null,
        checkOut: null,
        pending: false,
      };
      byKey.set(key, cell);
    }
    const punch = toPunchSummary(r, tz);
    if (r.type === "CHECK_IN") {
      cell.checkIn = pickEarlier(cell.checkIn, punch);
    } else {
      cell.checkOut = pickLater(cell.checkOut, punch);
    }
    if (r.status === "PENDING") cell.pending = true;
  }

  const rows: AdminAttendanceDayRow[] = [];
  for (const cell of byKey.values()) {
    const incomplete = Boolean(
      (cell.checkIn && !cell.checkOut) || (!cell.checkIn && cell.checkOut)
    );
    const row: AdminAttendanceDayRow = {
      id: `${cell.employeeId}:${cell.date}`,
      date: cell.date,
      employeeId: cell.employeeId,
      employeeName: cell.employeeName,
      checkIn: cell.checkIn,
      checkOut: cell.checkOut,
      incomplete,
      pending: cell.pending,
      status: dayStatus(cell.checkIn, cell.checkOut),
      isLate: cell.checkIn?.isLate ?? false,
      isEarlyLeave: cell.checkOut?.isEarlyLeave ?? false,
      isOvertime: cell.checkOut?.isOvertime ?? false,
      isHolidayWork: Boolean(cell.checkIn?.isHolidayWork || cell.checkOut?.isHolidayWork),
      overtimeMinutes: cell.checkOut?.overtimeMinutes ?? 0,
    };
    if (matchesStatusFilter(row, statusFilter)) {
      rows.push(row);
    }
  }

  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.employeeName.localeCompare(b.employeeName, "ko");
  });

  return rows;
}
