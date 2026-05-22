/** MVS 연동용 출퇴근 이벤트 스키마 (버전 고정 — 필드 추가 시 version 올림) */
export const MVS_ATTENDANCE_EVENT_VERSION = 1 as const;

export type MvsAttendanceEventType = "attendance.created";

export type MvsAttendanceEventV1 = {
  version: typeof MVS_ATTENDANCE_EVENT_VERSION;
  eventType: MvsAttendanceEventType;
  /** HereNow 출퇴근 레코드 ID */
  attendanceId: string;
  companyId: string;
  /** CompanyIntegration.externalCompanyId */
  externalCompanyId: string | null;
  employee: {
    id: string;
    name: string;
    email: string;
    externalEmployeeId: string | null;
  };
  type: "CHECK_IN" | "CHECK_OUT";
  /** UTC ISO 8601 */
  timestamp: string;
  timezone: string;
  /** 회사 타임존 기준 yyyy-MM-dd */
  localDate: string;
  /** 회사 타임존 기준 HH:mm */
  localTime: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
  };
  status: string;
  memo: string | null;
  isBusinessTrip: boolean;
  businessTripLocation: string | null;
  businessTripReason: string | null;
  photoUrl: string | null;
  deviceInfo: string | null;
  distanceFromSiteMeters: number;
  /** 출근 시 안면 검증 통과 여부 (퇴근은 false) */
  faceVerified: boolean;
  isLate: boolean;
  isEarlyLeave: boolean;
  isOvertime: boolean;
  isHolidayWork: boolean;
  overtimeMinutes: number;
};

export function isMvsAttendanceEventV1(value: unknown): value is MvsAttendanceEventV1 {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return o.version === MVS_ATTENDANCE_EVENT_VERSION && o.eventType === "attendance.created";
}
