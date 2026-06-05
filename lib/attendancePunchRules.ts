import type { AttendanceType } from "@prisma/client";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** 퇴근 후 이 시간 이내 재출근 시 관리자 승인 필요 */
export const FOUR_H_MS = 4 * 60 * 60 * 1000;
/** @deprecated 6시간 쿨다운 — 4시간 승인 규칙으로 대체됨 */
export const SIX_H_MS = 6 * 60 * 60 * 1000;
/** 출근 후 최대 퇴근 가능 시간 (철야·익일 퇴근 포함) */
export const FORTY_EIGHT_H_MS = 48 * 60 * 60 * 1000;
/** 출근~퇴근 1회당 최대 근무 시간 (총 21시간) */
export const MAX_SHIFT_WORK_MS = 21 * 60 * 60 * 1000;
/** @deprecated MAX_SHIFT_WORK_MS 사용 */
export const LATE_CHECKOUT_EIGHT_H_MS = MAX_SHIFT_WORK_MS;
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
  return "출근 후 48시간이 지났습니다. 퇴근은 가능하며, 퇴근 시각은 출근일 기준 출근 후 최대 21시간 또는 23:59 중 이른 시각으로 기록됩니다.";
}

/** 출근 후 48시간 초과 여부 */
export function isCheckOutPastWindow(checkInAt: Date, now: Date): boolean {
  return now.getTime() - checkInAt.getTime() > FORTY_EIGHT_H_MS;
}

export type LateCheckOutTimeBasis = "MAX_WORK_HOURS" | "END_OF_DAY";

/** @deprecated MAX_WORK_HOURS 사용 */
export type LegacyLateCheckOutTimeBasis = "EIGHT_HOURS" | LateCheckOutTimeBasis;

export type ResolvedLateCheckOutTimestamp = {
  /** DB에 저장할 퇴근 시각 */
  timestamp: Date;
  basis: LateCheckOutTimeBasis;
  checkInDay: string;
};

/** 출근 시각 + 최대 21시간 */
export function maxShiftWorkEndTimestamp(checkInAt: Date): Date {
  return new Date(checkInAt.getTime() + MAX_SHIFT_WORK_MS);
}

/**
 * 퇴근 시각을 총 21시간 이내로 제한한다.
 */
export function capCheckOutTimestamp(
  checkInAt: Date,
  proposedCheckOutAt: Date
): { timestamp: Date; capped: boolean } {
  const maxEnd = maxShiftWorkEndTimestamp(checkInAt);
  if (proposedCheckOutAt.getTime() <= maxEnd.getTime()) {
    return { timestamp: proposedCheckOutAt, capped: false };
  }
  return { timestamp: maxEnd, capped: true };
}

/**
 * 48시간 초과 지연 퇴근 — 출근일 기준 (출근+21시간)과 당일 23:59 중 이른 시각을 기록한다.
 */
export function resolveLateCheckOutTimestamp(
  checkInAt: Date,
  timeZone: string
): ResolvedLateCheckOutTimestamp {
  const tz = timeZone.trim() || "UTC";
  const checkInDay = calendarDayInTz(checkInAt, tz);
  const maxWorkEnd = maxShiftWorkEndTimestamp(checkInAt);

  let endOfDay: Date;
  try {
    endOfDay = fromZonedTime(`${checkInDay} 23:59:59`, tz);
  } catch {
    endOfDay = fromZonedTime(`${checkInDay} 23:59:59`, "UTC");
  }

  const candidate =
    maxWorkEnd.getTime() <= endOfDay.getTime() ? maxWorkEnd : endOfDay;
  const timestamp = new Date(Math.max(checkInAt.getTime(), candidate.getTime()));
  const basis: LateCheckOutTimeBasis =
    maxWorkEnd.getTime() <= endOfDay.getTime() &&
    timestamp.getTime() === maxWorkEnd.getTime()
      ? "MAX_WORK_HOURS"
      : "END_OF_DAY";

  return { timestamp, basis, checkInDay };
}

export function formatLateCheckOutBasisLabel(
  basis: LateCheckOutTimeBasis,
  locale: "ko" | "en"
): string {
  if (basis === "MAX_WORK_HOURS") {
    return locale === "en" ? "21 hours after check-in (max)" : "출근 후 최대 21시간";
  }
  return locale === "en" ? "23:59 on check-in day" : "출근일 23:59";
}

/** API·UI 호환 — 예전 EIGHT_HOURS 값 정규화 */
export function normalizeLateCheckOutTimeBasis(
  basis: string | null | undefined
): LateCheckOutTimeBasis | null {
  if (basis === "MAX_WORK_HOURS" || basis === "END_OF_DAY") return basis;
  if (basis === "EIGHT_HOURS") return "MAX_WORK_HOURS";
  return null;
}
