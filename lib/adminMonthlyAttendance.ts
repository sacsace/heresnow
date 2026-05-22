import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import type { AttendanceStatus, AttendanceType } from "@prisma/client";

export type MonthlyDayCell = {
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  /** 출근만 또는 퇴근만 */
  incomplete: boolean;
  pending: boolean;
};

export type MonthlyEmployeeRow = {
  id: string;
  name: string;
  days: MonthlyDayCell[];
};

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function monthRangeUtc(year: number, month: number, timeZone: string) {
  const tz = timeZone.trim() || "UTC";
  const m = String(month).padStart(2, "0");
  const dim = daysInMonth(year, month);
  const start = fromZonedTime(`${year}-${m}-01 00:00:00`, tz);
  const end = fromZonedTime(`${year}-${m}-${String(dim).padStart(2, "0")} 23:59:59.999`, tz);
  return { start, end, daysInMonth: dim };
}

export function calendarDayInTz(iso: Date, timeZone: string): string {
  const tz = timeZone.trim() || "UTC";
  try {
    return formatInTimeZone(iso, tz, "yyyy-MM-dd");
  } catch {
    return formatInTimeZone(iso, "UTC", "yyyy-MM-dd");
  }
}

export function timeInTz(iso: Date, timeZone: string): string {
  const tz = timeZone.trim() || "UTC";
  try {
    return formatInTimeZone(iso, tz, "HH:mm");
  } catch {
    return formatInTimeZone(iso, "UTC", "HH:mm");
  }
}

type RecordLike = {
  employeeId: string;
  type: AttendanceType;
  timestamp: Date;
  status: AttendanceStatus;
};

export function buildMonthlyRows(
  employees: { id: string; name: string }[],
  records: RecordLike[],
  year: number,
  month: number,
  timeZone: string
): MonthlyEmployeeRow[] {
  const dim = daysInMonth(year, month);
  const dayKeys: string[] = [];
  const m = String(month).padStart(2, "0");
  for (let d = 1; d <= dim; d++) {
    dayKeys.push(`${year}-${m}-${String(d).padStart(2, "0")}`);
  }

  const byEmpDay = new Map<
    string,
    Map<string, { checkIn: string | null; checkOut: string | null; pending: boolean }>
  >();

  for (const r of records) {
    const day = calendarDayInTz(r.timestamp, timeZone);
    if (!dayKeys.includes(day)) continue;
    let emp = byEmpDay.get(r.employeeId);
    if (!emp) {
      emp = new Map();
      byEmpDay.set(r.employeeId, emp);
    }
    let cell = emp.get(day);
    if (!cell) {
      cell = { checkIn: null, checkOut: null, pending: false };
      emp.set(day, cell);
    }
    const t = timeInTz(r.timestamp, timeZone);
    if (r.type === "CHECK_IN") {
      if (!cell.checkIn || t < cell.checkIn) cell.checkIn = t;
    } else {
      if (!cell.checkOut || t > cell.checkOut) cell.checkOut = t;
    }
    if (r.status === "PENDING") cell.pending = true;
  }

  return employees.map((e) => ({
    id: e.id,
    name: e.name,
    days: dayKeys.map((date) => {
      const c = byEmpDay.get(e.id)?.get(date);
      if (!c) {
        return { date, checkIn: null, checkOut: null, incomplete: false, pending: false };
      }
      const incomplete = Boolean((c.checkIn && !c.checkOut) || (!c.checkIn && c.checkOut));
      return {
        date,
        checkIn: c.checkIn,
        checkOut: c.checkOut,
        incomplete,
        pending: c.pending,
      };
    }),
  }));
}
