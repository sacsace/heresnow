import type { AttendanceType } from "@prisma/client";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** 퇴근 후 이 시간 이내 재출근 시 관리자 승인 필요 */
export const FOUR_H_MS = 4 * 60 * 60 * 1000;
/** @deprecated 6시간 쿨다운 — 4시간 승인 규칙으로 대체됨 */
export const SIX_H_MS = 6 * 60 * 60 * 1000;
/** 출근 후 최대 퇴근 가능 시간 (철야·익일 퇴근 포함) */
export const FORTY_EIGHT_H_MS = 48 * 60 * 60 * 1000;
/** @deprecated FORTY_EIGHT_H_MS 사용 */
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
  /** 퇴근 후 4시간 이내 재출근 — 사유·관리자 승인 필요 */
  reCheckInApprovalRequired: boolean;
  /** COOLDOWN 일 때 다음 출근 가능 시각 (ISO) — 레거시 */
  nextCheckInAt: string | null;
};

/**
 * 출퇴근 가능 여부 판정.
 * 규칙
 *  - 마지막 기록이 출근이면: 출근 불가, 퇴근 가능
 *  - 마지막 기록이 퇴근이면:
 *      · 퇴근 후 4시간 이내(같은 회사일) → 재출근 가능, 관리자 승인 필요
 *      · 4시간 경과 또는 회사 시간대 기준 날짜 변경 → 재출근 가능(승인 불필요)
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
      reCheckInApprovalRequired: false,
      nextCheckInAt: null,
    };
  }

  if (lastRecord.type === "CHECK_IN") {
    return {
      isCheckedIn: true,
      canCheckIn: false,
      canCheckOut: true,
      checkInBlock: "ALREADY_CHECKED_IN",
      reCheckInApprovalRequired: false,
      nextCheckInAt: null,
    };
  }

  const elapsed = now.getTime() - lastRecord.timestamp.getTime();
  const lastDay = calendarDayInTz(lastRecord.timestamp, tz);
  const nowDay = calendarDayInTz(now, tz);
  const midnightPass = lastDay !== nowDay;
  const fourHourPass = elapsed >= FOUR_H_MS;

  if (fourHourPass || midnightPass) {
    return {
      isCheckedIn: false,
      canCheckIn: true,
      canCheckOut: false,
      checkInBlock: null,
      reCheckInApprovalRequired: false,
      nextCheckInAt: null,
    };
  }

  const fourHourAt = new Date(lastRecord.timestamp.getTime() + FOUR_H_MS);
  const nextDayStr = nextCalendarDayStr(lastDay);
  const safeTz = (tz || "").trim() || "UTC";
  let midnightAt: Date;
  try {
    midnightAt = fromZonedTime(`${nextDayStr} 00:00:00`, safeTz);
  } catch {
    midnightAt = fromZonedTime(`${nextDayStr} 00:00:00`, "UTC");
  }
  const nextAt =
    fourHourAt.getTime() < midnightAt.getTime() ? fourHourAt : midnightAt;

  return {
    isCheckedIn: false,
    canCheckIn: true,
    canCheckOut: false,
    checkInBlock: null,
    reCheckInApprovalRequired: true,
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
    return "퇴근 후 4시간이 지나거나 자정이 지나야 승인 없이 다시 출근할 수 있습니다.";
  }
  return null;
}

export function checkOutWindowErrorMessage(): string {
  return "출근 시점부터 48시간이 지나 퇴근할 수 없습니다. 관리자에게 문의해 주세요.";
}
