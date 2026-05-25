import type { AttendanceType } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";

export const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000;

export function calendarDayInTz(isoDate: Date, timeZone: string): string {
  const tz = timeZone.trim() || "UTC";
  try {
    return formatInTimeZone(isoDate, tz, "yyyy-MM-dd");
  } catch {
    return formatInTimeZone(isoDate, "UTC", "yyyy-MM-dd");
  }
}

type PunchRecord = { type: AttendanceType; timestamp: Date };

export type PunchEligibility = {
  isCheckedIn: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  checkInBlock: "ALREADY_CHECKED_IN" | "COOLDOWN_24H" | null;
  /** COOLDOWN_24H 일 때 다음 출근 가능 시각 (ISO) */
  nextCheckInAt: string | null;
};

/**
 * 출퇴근 가능 여부 판정.
 * 규칙
 *  - 마지막 기록이 출근이면: 출근 불가, 퇴근 가능
 *  - 마지막 기록이 퇴근이면: 퇴근 시점부터 24시간이 지나야 다시 출근 가능
 *  - 기록이 없으면: 출근 가능
 */
export function evaluatePunchEligibility(
  now: Date,
  _tz: string,
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
  if (elapsed >= TWENTY_FOUR_H_MS) {
    return {
      isCheckedIn: false,
      canCheckIn: true,
      canCheckOut: false,
      checkInBlock: null,
      nextCheckInAt: null,
    };
  }

  const nextAt = new Date(lastRecord.timestamp.getTime() + TWENTY_FOUR_H_MS);
  return {
    isCheckedIn: false,
    canCheckIn: false,
    canCheckOut: false,
    checkInBlock: "COOLDOWN_24H",
    nextCheckInAt: nextAt.toISOString(),
  };
}

export function checkInErrorMessage(block: PunchEligibility["checkInBlock"]): string | null {
  if (block === "ALREADY_CHECKED_IN") {
    return "이미 출근하였습니다. 먼저 퇴근해 주세요.";
  }
  if (block === "COOLDOWN_24H") {
    return "퇴근 후 24시간이 지나야 다시 출근할 수 있습니다.";
  }
  return null;
}
