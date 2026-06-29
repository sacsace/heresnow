import { localMinutesFromDate, parseHHmm } from "@/lib/attendanceRules";
import { calendarDayInTz } from "@/lib/attendancePunchRules";
import {
  DEFAULT_WORK_END,
  localWeekday,
  normalizeWorkScheduleByDay,
  type CompanyWorkSchedule,
} from "@/lib/companyWorkSchedule";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { AttendanceType } from "@prisma/client";

/** 정규 퇴근 N분 전부터 출입문 단말을 퇴근 모드로 전환 */
export const DOOR_CHECKOUT_LEAD_MS = 30 * 60 * 1000;

export type DoorTerminalMode = AttendanceType;

export type DoorTerminalModeInfo = {
  mode: DoorTerminalMode;
  workEndTime: string;
  switchAt: string;
  timezone: string;
};

function nextCalendarDayStr(dayStr: string): string {
  const d = new Date(`${dayStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function resolveWorkEndStrForWeekday(weekday: number, schedule: CompanyWorkSchedule): string {
  const byDay = normalizeWorkScheduleByDay(schedule.workScheduleByDay);
  const dayWindow = byDay[weekday];
  return dayWindow?.workEndTime ?? schedule.workEndTime ?? DEFAULT_WORK_END;
}

/** 회사 타임존·오늘 요일 기준 정규 퇴근 시각 */
export function resolveTodayWorkEndAt(
  now: Date,
  timeZone: string,
  schedule: CompanyWorkSchedule
): Date {
  const tz = timeZone.trim() || "UTC";
  const weekday = localWeekday(now, tz);
  const byDay = normalizeWorkScheduleByDay(schedule.workScheduleByDay);
  const dayWindow = byDay[weekday];
  const startStr = dayWindow?.workStartTime ?? schedule.workStartTime ?? "09:00";
  const endStr = resolveWorkEndStrForWeekday(weekday, schedule);
  const startMin = parseHHmm(startStr);
  const endMin = parseHHmm(endStr);
  const today = calendarDayInTz(now, tz);
  const nowMin = localMinutesFromDate(now, tz);

  const isOvernight = startMin != null && endMin != null && endMin <= startMin;
  let endDay = today;
  if (isOvernight && nowMin >= (startMin ?? 0)) {
    endDay = nextCalendarDayStr(today);
  }

  try {
    return fromZonedTime(`${endDay} ${endStr}:00`, tz);
  } catch {
    return fromZonedTime(`${endDay} ${endStr}:00`, "UTC");
  }
}

/**
 * 출입문 단말 모드 — 정규 퇴근 30분 전부터 CHECK_OUT, 그 외 CHECK_IN.
 * 퇴근 모드는 당일 자정까지 유지(늦은 퇴근 포함).
 */
export function resolveDoorTerminalMode(
  now: Date,
  timeZone: string,
  schedule: CompanyWorkSchedule
): DoorTerminalModeInfo {
  const tz = timeZone.trim() || "UTC";
  const weekday = localWeekday(now, tz);
  const workEndTime = resolveWorkEndStrForWeekday(weekday, schedule);
  const workEndAt = resolveTodayWorkEndAt(now, tz, schedule);
  const switchAt = new Date(workEndAt.getTime() - DOOR_CHECKOUT_LEAD_MS);

  const today = calendarDayInTz(now, tz);
  let endOfDay: Date;
  try {
    endOfDay = fromZonedTime(`${today} 23:59:59.999`, tz);
  } catch {
    endOfDay = fromZonedTime(`${today} 23:59:59.999`, "UTC");
  }

  const inCheckoutWindow =
    now.getTime() >= switchAt.getTime() && now.getTime() <= endOfDay.getTime();

  return {
    mode: inCheckoutWindow ? "CHECK_OUT" : "CHECK_IN",
    workEndTime,
    switchAt: switchAt.toISOString(),
    timezone: tz,
  };
}

export function formatDoorSwitchTime(iso: string, timeZone: string, locale: string): string {
  try {
    return formatInTimeZone(new Date(iso), timeZone, locale === "en" ? "h:mm a" : "HH:mm");
  } catch {
    return iso;
  }
}
