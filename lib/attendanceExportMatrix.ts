import type { AdminAttendanceDayRow } from "@/lib/adminAttendanceByDay";
import { calendarDayInTz } from "@/lib/adminMonthlyAttendance";
import { parseWorkDays } from "@/lib/companyWorkSchedule";
import { formatInTimeZone } from "date-fns-tz";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** 정상 출근 */
export const ATTENDANCE_EXPORT_PRESENT = "O";
/** 지각 */
export const ATTENDANCE_EXPORT_LATE = "△";
/** 조퇴(반차) */
export const ATTENDANCE_EXPORT_HALF_DAY = "0.5";

export type AttendanceExportSchedule = {
  workDays: string | null;
  timeZone: string;
};

type EmpDayState = {
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  isHolidayWork: boolean;
  isLate: boolean;
  isEarlyLeave: boolean;
  lateMinutes: number;
  overtimeMinutes: number;
};

function emptyEmpDayState(): EmpDayState {
  return {
    hasCheckIn: false,
    hasCheckOut: false,
    isHolidayWork: false,
    isLate: false,
    isEarlyLeave: false,
    lateMinutes: 0,
    overtimeMinutes: 0,
  };
}

/** 달력 셀 — 조퇴(0.5) > 지각(△) > 출근(O) */
export function formatAttendanceExportCell(state: EmpDayState | undefined): string {
  if (!state) return "";
  const attended = state.hasCheckIn || state.hasCheckOut;
  if (!attended) return "";

  if (state.isEarlyLeave && !state.isHolidayWork) return ATTENDANCE_EXPORT_HALF_DAY;
  if (state.isLate && state.hasCheckIn) return ATTENDANCE_EXPORT_LATE;
  return ATTENDANCE_EXPORT_PRESENT;
}

/** 퇴근 기록 없을 때 OT에서 추가 차감(분) */
export const MISSING_CHECKOUT_OT_DEDUCT_MINUTES = 60;

/**
 * 일별 OT — 지각 차감 후, 퇴근 없으면 1시간 추가 차감
 */
export function netOvertimeMinutesForDay(
  overtimeMinutes: number,
  lateMinutes: number,
  hasCheckOut: boolean
): number {
  let net = Math.max(0, overtimeMinutes - lateMinutes);
  if (!hasCheckOut && net > 0) {
    net = Math.max(0, net - MISSING_CHECKOUT_OT_DEDUCT_MINUTES);
  }
  return net;
}

function dateWeekday(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

/** 회사 근무일·오늘 이전만 — 결근/근무일수 산정용 */
function businessDatesInRange(
  from: string,
  to: string,
  workDaySet: Set<number>,
  todayStr: string
): string[] {
  return enumerateDateRange(from, to).filter(
    (d) => d <= todayStr && workDaySet.has(dateWeekday(d))
  );
}

function formatOtMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  if (safe === 0) return "";
  if (safe < 60) return `${safe}분`;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/** 회사 타임존 기준 from~to 모든 날짜 (yyyy-MM-dd) */
export function enumerateDateRange(from: string, to: string): string[] {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const cur = new Date(y1, (m1 ?? 1) - 1, d1 ?? 1);
  const end = new Date(y2, (m2 ?? 1) - 1, d2 ?? 1);
  const out: string[] = [];
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function resolveExportDateRange(
  from: string | undefined,
  to: string | undefined,
  days: AdminAttendanceDayRow[],
  timeZone: string
): { from: string; to: string } {
  if (from && to && DATE_ONLY.test(from) && DATE_ONLY.test(to)) {
    return from <= to ? { from, to } : { from: to, to: from };
  }
  if (days.length === 0) {
    const today = formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd");
    return { from: today, to: today };
  }
  let min = days[0]!.date;
  let max = days[0]!.date;
  for (const d of days) {
    if (d.date < min) min = d.date;
    if (d.date > max) max = d.date;
  }
  return { from: min, to: max };
}

export type AttendanceMatrixRow = {
  employeeId: string;
  name: string;
  /** dates 순서와 동일 — 출근 시 O, 미출근 빈칸 */
  cells: string[];
  /** 기간 내 초과근무 합계 */
  otTotal: string;
  /** 결근·반차(0.5) 합산 — 반차 2회 = 1일 */
  absentDays: number;
  /** 근무일수 — 조퇴는 0.5일 */
  workDays: number;
  holidayWorkDays: number;
};

export type AttendanceMatrix = {
  dates: string[];
  /** 날짜 열 헤더 (MM/dd) */
  dateHeaders: string[];
  rows: AttendanceMatrixRow[];
};

function formatDateHeader(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function ensureEmpDay(
  empDays: Map<string, Map<string, EmpDayState>>,
  employeeId: string,
  date: string
): EmpDayState {
  let byDate = empDays.get(employeeId);
  if (!byDate) {
    byDate = new Map();
    empDays.set(employeeId, byDate);
  }
  let state = byDate.get(date);
  if (!state) {
    state = emptyEmpDayState();
    byDate.set(date, state);
  }
  return state;
}

export function buildAttendancePresenceMatrix(
  days: AdminAttendanceDayRow[],
  employees: { id: string; name: string }[],
  from: string,
  to: string,
  schedule: AttendanceExportSchedule
): AttendanceMatrix {
  const dates = enumerateDateRange(from, to);
  const dateHeaders = dates.map(formatDateHeader);
  const dateSet = new Set(dates);
  const workDaySet = parseWorkDays(schedule.workDays);
  const todayStr = calendarDayInTz(new Date(), schedule.timeZone);
  const businessDates = businessDatesInRange(from, to, workDaySet, todayStr);

  const otMinutes = new Map<string, number>();
  const empDays = new Map<string, Map<string, EmpDayState>>();

  for (const d of days) {
    if (!dateSet.has(d.date)) continue;
    const state = ensureEmpDay(empDays, d.employeeId, d.date);
    if (d.checkIn) state.hasCheckIn = true;
    if (d.checkOut) state.hasCheckOut = true;
    if (d.isHolidayWork) state.isHolidayWork = true;
    if (d.isLate) state.isLate = true;
    if (d.isEarlyLeave) state.isEarlyLeave = true;
    if (d.lateMinutes > state.lateMinutes) state.lateMinutes = d.lateMinutes;
    if (d.overtimeMinutes > state.overtimeMinutes) state.overtimeMinutes = d.overtimeMinutes;
  }

  for (const [empId, dayMap] of empDays) {
    let sum = 0;
    for (const s of dayMap.values()) {
      sum += netOvertimeMinutesForDay(s.overtimeMinutes, s.lateMinutes, s.hasCheckOut);
    }
    if (sum > 0) otMinutes.set(empId, sum);
  }

  const rows = employees.map((emp) => {
    const dayMap = empDays.get(emp.id);
    let absentDays = 0;
    let workDays = 0;
    let holidayWorkDays = 0;

    for (const day of businessDates) {
      const s = dayMap?.get(day);
      if (!s || (!s.hasCheckIn && !s.hasCheckOut)) {
        absentDays += 1;
        continue;
      }
      if (s.isEarlyLeave) {
        workDays += 0.5;
        absentDays += 0.5;
      } else {
        workDays += 1;
      }
    }

    if (dayMap) {
      for (const [date, s] of dayMap) {
        if (!dateSet.has(date)) continue;
        if (s.isHolidayWork && (s.hasCheckIn || s.hasCheckOut)) holidayWorkDays += 1;
      }
    }

    return {
      employeeId: emp.id,
      name: emp.name,
      cells: dates.map((date) => formatAttendanceExportCell(dayMap?.get(date))),
      otTotal: formatOtMinutes(otMinutes.get(emp.id) ?? 0),
      absentDays,
      workDays,
      holidayWorkDays,
    };
  });

  return { dates, dateHeaders, rows };
}
