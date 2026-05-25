import type { AttendanceType } from "@prisma/client";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const SIX_H_MS = 6 * 60 * 60 * 1000;
export const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000;

export function calendarDayInTz(isoDate: Date, timeZone: string): string {
  const tz = timeZone.trim() || "UTC";
  try {
    return formatInTimeZone(isoDate, tz, "yyyy-MM-dd");
  } catch {
    return formatInTimeZone(isoDate, "UTC", "yyyy-MM-dd");
  }
}

function nextCalendarDayStr(dayStr: string): string {
  const d = new Date(`${dayStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

type PunchRecord = { type: AttendanceType; timestamp: Date };

export type PunchEligibility = {
  isCheckedIn: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  checkInBlock: "ALREADY_CHECKED_IN" | "COOLDOWN" | null;
  /** COOLDOWN 일 때 다음 출근 가능 시각 (ISO) */
  nextCheckInAt: string | null;
};

/**
 * 출퇴근 가능 여부 판정.
 * 규칙
 *  - 마지막 기록이 출근이면: 출근 불가, 퇴근 가능
 *  - 마지막 기록이 퇴근이면: 퇴근 후 6시간 경과 OR 회사 시간대 기준 자정 지남(달력 날짜 바뀜) 중
 *    하나라도 충족하면 다시 출근 가능
 *  - 기록이 없으면: 출근 가능
 */
export function evaluatePunchEligibility(
  now: Date,
  tz: string,
  lastRecord: PunchRecord | null
): PunchEligibility {
  if (!lastRecord) {
    return {
      isCheckedIn: false,
      canCheckIn: true,
      canCheckOut: false,
      checkInBlock: null,
      nextCheckInAt: null,
    };
  }

  if (lastRecord.type === "CHECK_IN") {
    return {
      isCheckedIn: true,
      canCheckIn: false,
      canCheckOut: true,
      checkInBlock: "ALREADY_CHECKED_IN",
      nextCheckInAt: null,
    };
  }

  const elapsed = now.getTime() - lastRecord.timestamp.getTime();
  const sixHourPass = elapsed >= SIX_H_MS;
  const lastDay = calendarDayInTz(lastRecord.timestamp, tz);
  const nowDay = calendarDayInTz(now, tz);
  const midnightPass = lastDay !== nowDay;

  if (sixHourPass || midnightPass) {
    return {
      isCheckedIn: false,
      canCheckIn: true,
      canCheckOut: false,
      checkInBlock: null,
      nextCheckInAt: null,
    };
  }

  const sixHourAt = new Date(lastRecord.timestamp.getTime() + SIX_H_MS);
  const nextDayStr = nextCalendarDayStr(lastDay);
  const safeTz = (tz || "").trim() || "UTC";
  let midnightAt: Date;
  try {
    midnightAt = fromZonedTime(`${nextDayStr} 00:00:00`, safeTz);
  } catch {
    midnightAt = fromZonedTime(`${nextDayStr} 00:00:00`, "UTC");
  }
  const nextAt =
    sixHourAt.getTime() < midnightAt.getTime() ? sixHourAt : midnightAt;

  return {
    isCheckedIn: false,
    canCheckIn: false,
    canCheckOut: false,
    checkInBlock: "COOLDOWN",
    nextCheckInAt: nextAt.toISOString(),
  };
}

export function checkInErrorMessage(
  block: PunchEligibility["checkInBlock"]
): string | null {
  if (block === "ALREADY_CHECKED_IN") {
    return "이미 출근하였습니다. 먼저 퇴근해 주세요.";
  }
  if (block === "COOLDOWN") {
    return "퇴근 후 6시간이 지나거나 자정이 지나야 다시 출근할 수 있습니다.";
  }
  return null;
}
