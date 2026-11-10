import { isAutoCheckOutMemo } from "@/lib/autoCheckOutDisplay";
import { parseWorkDays } from "@/lib/companyWorkSchedule";
import { recordDisplayTimezone } from "@/lib/companyTimezones";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import type { AttendanceStatus, AttendanceType } from "@prisma/client";

export type MonthlyDayCell = {
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  /** 정규 퇴근 시각 자동 등록 */
  checkOutAuto?: boolean;
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
  memo?: string | null;
  recordTimezone?: string | null;
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
    Map<
      string,
      {
        checkIn: string | null;
        checkOut: string | null;
        checkOutAuto: boolean;
        pending: boolean;
      }
    >
  >();

  for (const r of records) {
    const rt = recordDisplayTimezone(r, timeZone);
    const day = calendarDayInTz(r.timestamp, rt);
    if (!dayKeys.includes(day)) continue;
    let emp = byEmpDay.get(r.employeeId);
    if (!emp) {
      emp = new Map();
      byEmpDay.set(r.employeeId, emp);
    }
    let cell = emp.get(day);
    if (!cell) {
      cell = { checkIn: null, checkOut: null, checkOutAuto: false, pending: false };
      emp.set(day, cell);
    }
    const t = timeInTz(r.timestamp, rt);
    if (r.type === "CHECK_IN") {
      if (!cell.checkIn || t < cell.checkIn) cell.checkIn = t;
    } else {
      if (!cell.checkOut || t > cell.checkOut) {
        cell.checkOut = t;
        cell.checkOutAuto = isAutoCheckOutMemo(r.memo);
      }
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
        checkOutAuto: c.checkOutAuto,
        incomplete,
        pending: c.pending,
      };
    }),
  }));
}

function calendarWeekday(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

export type MonthlyEmployeeWorkSummary = {
  /** 회사 근무 요일 기준 총 근무일(오늘 이전) */
  scheduledDays: number;
  /** 출근·퇴근 기록이 있는 근무일 */
  workedDays: number;
  /** 기록 없는 근무일 = 결근 */
  absentDays: number;
  /** 결근으로 표시할 날짜 */
  absentDates: string[];
};

/**
 * 월간 직원 상세 — 총 근무일·근무일수·결근일수.
 * 회사 근무 요일 중 오늘 이전만 집계(엑셀 내보내기와 동일).
 */
export function summarizeMonthlyEmployeeWork(
  days: MonthlyDayCell[],
  workDays: string | null | undefined,
  timeZone: string,
  now: Date = new Date()
): MonthlyEmployeeWorkSummary {
  const workDaySet = parseWorkDays(workDays);
  const todayStr = calendarDayInTz(now, timeZone.trim() || "UTC");
  let scheduledDays = 0;
  let workedDays = 0;
  let absentDays = 0;
  const absentDates: string[] = [];

  for (const d of days) {
    if (d.date > todayStr) continue;
    if (!workDaySet.has(calendarWeekday(d.date))) continue;
    scheduledDays += 1;
    if (d.checkIn || d.checkOut) {
      workedDays += 1;
    } else {
      absentDays += 1;
      absentDates.push(d.date);
    }
  }

  return { scheduledDays, workedDays, absentDays, absentDates };
}
