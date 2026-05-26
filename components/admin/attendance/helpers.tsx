import { metaCaption } from "@/lib/statusBadge";
import type { AdminAttendanceDayRow, AttendancePunchSummary } from "@/lib/adminAttendanceByDay";

type T = (path: string) => string;

export function formatShortDate(date: string, locale = "ko-KR") {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    month: "numeric",
    day: "numeric",
  });
}

export function formatAttendanceDate(date: string, locale = "ko-KR") {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function locationLabel(p: AttendancePunchSummary, t?: T) {
  if (p.isBusinessTrip && p.businessTripLocation) {
    return p.businessTripLocation;
  }
  if (p.site?.name) {
    const distance = Math.round(p.distanceFromSite);
    const distanceText = t
      ? t("admin.attendanceLocationDistance").replace("{m}", String(distance))
      : `약 ${distance}m`;
    return (
      <>
        {p.site.name}
        <span className={metaCaption}>{distanceText}</span>
      </>
    );
  }
  return null;
}

export function attendanceFlagsRow(
  r: Pick<
    AdminAttendanceDayRow,
    "isHolidayWork" | "isLate" | "isEarlyLeave" | "isOvertime" | "overtimeMinutes"
  >,
  t?: T
) {
  if (!r.isHolidayWork && !r.isLate && !r.isEarlyLeave && !r.isOvertime) {
    return <span className="text-[var(--apple-label-tertiary)]">—</span>;
  }
  const lbl = (key: string, fallback: string) => (t ? t(key) : fallback);
  const overtimeMinLabel = (n: number) =>
    t
      ? t("admin.attendanceOvertimeMinutes").replace("{n}", String(n))
      : `${n}분`;
  return (
    <>
      {r.isHolidayWork && (
        <span className="font-medium text-[var(--apple-blue)]">
          {lbl("admin.attendanceFlagHolidayWork", "휴일근무")}{" "}
        </span>
      )}
      {r.isLate && (
        <span className="font-medium text-[var(--apple-orange-dark)]">
          {lbl("admin.attendanceFlagLate", "지각")}{" "}
        </span>
      )}
      {r.isEarlyLeave && (
        <span className="font-medium text-[var(--apple-orange-dark)]">
          {lbl("admin.attendanceFlagEarlyLeave", "조퇴")}{" "}
        </span>
      )}
      {r.isOvertime && (
        <span className="font-medium text-[var(--apple-blue)]">
          {lbl("admin.attendanceFlagOvertime", "초과")}
          {r.overtimeMinutes > 0 ? ` ${overtimeMinLabel(r.overtimeMinutes)}` : ""}{" "}
        </span>
      )}
    </>
  );
}

export function groupRowsByEmployee(rows: AdminAttendanceDayRow[]) {
  const map = new Map<string, AdminAttendanceDayRow[]>();
  for (const row of rows) {
    const list = map.get(row.employeeId) ?? [];
    list.push(row);
    map.set(row.employeeId, list);
  }
  return [...map.values()]
    .map((list) =>
      [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    )
    .sort((a, b) => a[0]!.employeeName.localeCompare(b[0]!.employeeName, "ko"));
}

export function chartSeriesFromRows(rows: AdminAttendanceDayRow[], days = 14) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.checkIn) {
      counts.set(row.date, (counts.get(row.date) ?? 0) + 1);
    }
  }
  const sortedDates = [...counts.keys()].sort((a, b) => (a < b ? 1 : -1)).slice(0, days);
  return sortedDates
    .sort()
    .map((date) => ({
      date,
      count: counts.get(date) ?? 0,
      label: date.slice(5).replace("-", "/"),
    }));
}
