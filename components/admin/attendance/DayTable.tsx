"use client";

import { StaticMap } from "@/components/admin/StaticMap";
import {
  attendanceFlagsRow,
  formatAttendanceDate,
  formatShortDate,
  formatWorkDuration,
  locationLabel,
} from "@/components/admin/attendance/helpers";
import { useI18n } from "@/components/LanguageProvider";
import type { AdminAttendanceDayRow } from "@/lib/adminAttendanceByDay";
import { statusBadge } from "@/lib/statusBadge";
import { table, tableHead, tableWrap, td, th, trDivider } from "@/lib/uiStyles";

type Props = {
  rows: AdminAttendanceDayRow[];
  showEmployee?: boolean;
  dateLocale?: string;
};

export function AttendanceDayTable({ rows, showEmployee = true, dateLocale }: Props) {
  const { t, locale } = useI18n();
  const dl = dateLocale ?? (locale === "en" ? "en-US" : "ko-KR");

  const mapLabel = (employeeName: string, type: "checkIn" | "checkOut") =>
    t(
      type === "checkIn"
        ? "admin.attendanceMapCheckInLabel"
        : "admin.attendanceMapCheckOutLabel"
    ).replace("{name}", employeeName);

  return (
    <div className={tableWrap}>
      <table className={table}>
        <thead className={tableHead}>
          <tr>
            <th className={th}>{t("admin.attendanceColDate")}</th>
            {showEmployee && <th className={th}>{t("admin.attendanceColEmployee")}</th>}
            <th className={th}>{t("admin.attendanceColCheckIn")}</th>
            <th className={th}>{t("admin.attendanceColCheckOut")}</th>
            <th className={th}>{t("admin.attendanceColWorkHours")}</th>
            <th className={th}>{t("admin.attendanceColTrip")}</th>
            <th className={th}>{t("admin.attendanceColStatus")}</th>
            <th className={th}>{t("admin.attendanceColFlags")}</th>
            <th className={th}>{t("admin.attendanceColMap")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const checkInExtra = r.checkIn ? locationLabel(r.checkIn, t) : null;
            const checkOutExtra = r.checkOut ? locationLabel(r.checkOut, t) : null;
            const workDuration = formatWorkDuration(r.checkIn, r.checkOut, t);
            return (
              <tr key={r.id} className={trDivider}>
                <td className={`${td} whitespace-nowrap`}>
                  {formatAttendanceDate(r.date, dl)}
                  {r.incomplete && (
                    <span className="mt-1 block text-[0.75rem] font-medium text-[var(--apple-orange-dark)]">
                      {t("admin.attendanceIncomplete")}
                    </span>
                  )}
                </td>
                {showEmployee && <td className={`${td} font-semibold`}>{r.employeeName}</td>}
                <td className={`${td} text-[0.875rem] text-[var(--apple-label-secondary)]`}>
                  {r.checkIn ? (
                    <>
                      <span className="font-semibold text-[var(--foreground)]">{r.checkIn.time}</span>
                      {checkInExtra ? <span className="mt-1 block">{checkInExtra}</span> : null}
                    </>
                  ) : (
                    <span className="text-[var(--apple-label-tertiary)]">—</span>
                  )}
                </td>
                <td className={`${td} text-[0.875rem] text-[var(--apple-label-secondary)]`}>
                  {r.checkOut ? (
                    <>
                      <span className="font-semibold text-[var(--foreground)]">
                        {r.checkOutDate && r.checkOutDate !== r.date
                          ? `${formatShortDate(r.checkOutDate, dl)} ${r.checkOut.time}`
                          : r.checkOut.time}
                      </span>
                      {checkOutExtra ? <span className="mt-1 block">{checkOutExtra}</span> : null}
                    </>
                  ) : (
                    <span className="text-[var(--apple-label-tertiary)]">—</span>
                  )}
                </td>
                <td className={`${td} whitespace-nowrap text-[0.875rem] font-medium tabular-nums`}>
                  {workDuration ?? (
                    <span className="font-normal text-[var(--apple-label-tertiary)]">—</span>
                  )}
                </td>
                <td className={`${td} text-[0.875rem]`}>
                  {r.checkIn?.isBusinessTrip ? (
                    <span title={r.checkIn.businessTripReason ?? ""}>
                      {r.checkIn.businessTripLocation ?? t("admin.attendanceTripFallback")}
                      {r.checkIn.businessTripReason ? (
                        <span className="mt-1 block max-w-[12rem] truncate text-[0.75rem] text-[var(--apple-label-tertiary)]">
                          {r.checkIn.businessTripReason}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={td}>
                  <span className={statusBadge(r.status)}>{r.status}</span>
                </td>
                <td className={`${td} text-[0.8125rem] text-[var(--apple-label-secondary)]`}>
                  {attendanceFlagsRow(r, t)}
                </td>
                <td className={td}>
                  {r.checkIn ? (
                    <StaticMap
                      lat={r.checkIn.latitude}
                      lng={r.checkIn.longitude}
                      label={mapLabel(r.employeeName, "checkIn")}
                    />
                  ) : r.checkOut ? (
                    <StaticMap
                      lat={r.checkOut.latitude}
                      lng={r.checkOut.longitude}
                      label={mapLabel(r.employeeName, "checkOut")}
                    />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
