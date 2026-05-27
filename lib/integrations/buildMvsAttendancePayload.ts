import type { AttendanceRecord, Company, Employee, User } from "@prisma/client";
import { DEFAULT_COMPANY_TIMEZONE, recordDisplayTimezone } from "@/lib/companyTimezones";
import { formatInTimeZone } from "date-fns-tz";
import {
  MVS_ATTENDANCE_EVENT_VERSION,
  type MvsAttendanceEventV1,
} from "@/lib/integrations/mvsTypes";

type AttendanceWithRelations = AttendanceRecord & {
  employee: Employee & { user: Pick<User, "email"> };
  company: Pick<Company, "timezone">;
};

export function buildMvsAttendancePayload(
  record: AttendanceWithRelations,
  externalCompanyId: string | null,
  faceVerified: boolean
): MvsAttendanceEventV1 {
  const tz = recordDisplayTimezone(record, record.company.timezone.trim() || DEFAULT_COMPANY_TIMEZONE);
  let localDate: string;
  let localTime: string;
  try {
    localDate = formatInTimeZone(record.timestamp, tz, "yyyy-MM-dd");
    localTime = formatInTimeZone(record.timestamp, tz, "HH:mm");
  } catch {
    localDate = formatInTimeZone(record.timestamp, "UTC", "yyyy-MM-dd");
    localTime = formatInTimeZone(record.timestamp, "UTC", "HH:mm");
  }

  return {
    version: MVS_ATTENDANCE_EVENT_VERSION,
    eventType: "attendance.created",
    attendanceId: record.id,
    companyId: record.companyId,
    externalCompanyId,
    employee: {
      id: record.employee.id,
      name: record.employee.name,
      email: record.employee.user.email,
      externalEmployeeId: record.employee.externalEmployeeId,
    },
    type: record.type,
    timestamp: record.timestamp.toISOString(),
    timezone: tz,
    localDate,
    localTime,
    location: {
      latitude: record.latitude,
      longitude: record.longitude,
      accuracy: record.accuracy,
    },
    status: record.status,
    memo: record.memo,
    isBusinessTrip: record.isBusinessTrip,
    businessTripLocation: record.businessTripLocation,
    businessTripReason: record.businessTripReason,
    photoUrl: record.photoUrl,
    deviceInfo: record.deviceInfo,
    distanceFromSiteMeters: record.distanceFromSite,
    faceVerified,
    isLate: record.isLate,
    isEarlyLeave: record.isEarlyLeave,
    isOvertime: record.isOvertime,
    isHolidayWork: record.isHolidayWork,
    lateMinutes: record.lateMinutes,
    overtimeMinutes: record.overtimeMinutes,
  };
}
