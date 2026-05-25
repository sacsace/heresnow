"use client";

import { StaticMap } from "@/components/admin/StaticMap";
import {
  attendanceFlagsRow,
  formatAttendanceDate,
  formatShortDate,
  locationLabel,
} from "@/components/admin/attendance/helpers";
import type { AdminAttendanceDayRow } from "@/lib/adminAttendanceByDay";
import { statusBadge } from "@/lib/statusBadge";
import { table, tableHead, tableWrap, td, th, trDivider } from "@/lib/uiStyles";

type Props = {
  rows: AdminAttendanceDayRow[];
  showEmployee?: boolean;
  dateLocale?: string;
};

export function AttendanceDayTable({ rows, showEmployee = true, dateLocale = "ko-KR" }: Props) {
  return (
    <div className={tableWrap}>
      <table className={table}>
        <thead className={tableHead}>
          <tr>
            <th className={th}>날짜</th>
            {showEmployee && <th className={th}>직원</th>}
            <th className={th}>출근</th>
            <th className={th}>퇴근</th>
            <th className={th}>출장</th>
            <th className={th}>상태</th>
            <th className={th}>근태</th>
            <th className={th}>지도</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const checkInExtra = r.checkIn ? locationLabel(r.checkIn) : null;
            const checkOutExtra = r.checkOut ? locationLabel(r.checkOut) : null;
            return (
            <tr key={r.id} className={trDivider}>
              <td className={`${td} whitespace-nowrap`}>
                {formatAttendanceDate(r.date, dateLocale)}
                {r.incomplete && (
                  <span className="mt-1 block text-[0.75rem] font-medium text-[var(--apple-orange-dark)]">
                    미완료
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
                        ? `${formatShortDate(r.checkOutDate, dateLocale)} ${r.checkOut.time}`
                        : r.checkOut.time}
                    </span>
                    {checkOutExtra ? <span className="mt-1 block">{checkOutExtra}</span> : null}
                  </>
                ) : (
                  <span className="text-[var(--apple-label-tertiary)]">—</span>
                )}
              </td>
              <td className={`${td} text-[0.875rem]`}>
                {r.checkIn?.isBusinessTrip ? (
                  <span title={r.checkIn.businessTripReason ?? ""}>
                    {r.checkIn.businessTripLocation ?? "출장"}
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
                {attendanceFlagsRow(r)}
              </td>
              <td className={td}>
                {r.checkIn ? (
                  <StaticMap
                    lat={r.checkIn.latitude}
                    lng={r.checkIn.longitude}
                    label={`${r.employeeName} 출근`}
                  />
                ) : r.checkOut ? (
                  <StaticMap
                    lat={r.checkOut.latitude}
                    lng={r.checkOut.longitude}
                    label={`${r.employeeName} 퇴근`}
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
