"use client";

import { StaticMap } from "@/components/admin/StaticMap";
import {
  STANDARD_WORK_MINUTES,
  attendanceFlagsRow,
  formatAttendanceDate,
  formatShortDate,
  formatWorkDuration,
  locationLabel,
  workMinutesOf,
} from "@/components/admin/attendance/helpers";
import { useI18n } from "@/components/LanguageProvider";
import type { AdminAttendanceDayRow } from "@/lib/adminAttendanceByDay";
import { statusBadge } from "@/lib/statusBadge";
import { table, tableHead, tableWrap, td, th, trDivider } from "@/lib/uiStyles";
import { useMemo, useState } from "react";

type Props = {
  rows: AdminAttendanceDayRow[];
  showEmployee?: boolean;
  dateLocale?: string;
};

type SortKey =
  | "date"
  | "employee"
  | "checkIn"
  | "checkOut"
  | "workHours"
  | "trip"
  | "status"
  | "flags";

type SortDir = "asc" | "desc";

function compareString(a: string, b: string, locale = "ko") {
  return a.localeCompare(b, locale);
}

function compareNumber(a: number, b: number) {
  return a - b;
}

function tripValue(row: AdminAttendanceDayRow): string {
  return row.checkIn?.isBusinessTrip
    ? row.checkIn.businessTripLocation ?? "ZZZ_TRIP"
    : "";
}

function flagsValue(row: AdminAttendanceDayRow): number {
  // Higher = more issues. -lateMinutes 등으로 정렬 가능
  let v = 0;
  if (row.isHolidayWork) v += 100;
  if (row.isLate) v += 1000 + row.lateMinutes;
  if (row.isEarlyLeave) v += 500;
  if (row.isOvertime) v += 50;
  return v;
}

function workMinForRow(row: AdminAttendanceDayRow): number {
  return workMinutesOf(row.checkIn, row.checkOut) ?? -1;
}

function compareRows(
  a: AdminAttendanceDayRow,
  b: AdminAttendanceDayRow,
  key: SortKey
): number {
  switch (key) {
    case "date": {
      if (a.date !== b.date) return compareString(a.date, b.date);
      const ai = a.checkIn?.timestamp ?? "";
      const bi = b.checkIn?.timestamp ?? "";
      return compareString(ai, bi);
    }
    case "employee":
      return compareString(a.employeeName, b.employeeName);
    case "checkIn":
      return compareString(a.checkIn?.timestamp ?? "", b.checkIn?.timestamp ?? "");
    case "checkOut":
      return compareString(a.checkOut?.timestamp ?? "", b.checkOut?.timestamp ?? "");
    case "workHours":
      return compareNumber(workMinForRow(a), workMinForRow(b));
    case "trip":
      return compareString(tripValue(a), tripValue(b));
    case "status":
      return compareString(String(a.status), String(b.status));
    case "flags":
      return compareNumber(flagsValue(a), flagsValue(b));
    default:
      return 0;
  }
}

export function AttendanceDayTable({ rows, showEmployee = true, dateLocale }: Props) {
  const { t, locale } = useI18n();
  const dl = dateLocale ?? (locale === "en" ? "en-US" : "ko-KR");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const cmp = compareRows(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  function toggleSort(next: SortKey) {
    if (next === sortKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(next);
      // 텍스트 컬럼은 asc 가 기본, 날짜·시간·근무시간·근태점수는 desc 가 기본
      const defaultDesc: SortKey[] = ["date", "checkIn", "checkOut", "workHours", "flags"];
      setSortDir(defaultDesc.includes(next) ? "desc" : "asc");
    }
  }

  const arrow = (key: SortKey) => {
    if (sortKey !== key) {
      return (
        <span aria-hidden="true" className="ml-1 text-[var(--apple-label-tertiary)] opacity-50">
          ↕
        </span>
      );
    }
    return (
      <span aria-hidden="true" className="ml-1 text-[var(--apple-blue)]">
        {sortDir === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  const sortableTh = (key: SortKey, label: string, extraClass = "") => (
    <th
      className={`${th} ${extraClass}`}
      aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="inline-flex items-center gap-0 text-inherit hover:text-[var(--foreground)] cursor-pointer select-none"
      >
        {label}
        {arrow(key)}
      </button>
    </th>
  );

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
            {sortableTh("date", t("admin.attendanceColDate"))}
            {showEmployee && sortableTh("employee", t("admin.attendanceColEmployee"))}
            {sortableTh("checkIn", t("admin.attendanceColCheckIn"))}
            {sortableTh("checkOut", t("admin.attendanceColCheckOut"))}
            {sortableTh("workHours", t("admin.attendanceColWorkHours"))}
            {sortableTh("trip", t("admin.attendanceColTrip"))}
            {sortableTh("status", t("admin.attendanceColStatus"))}
            {sortableTh("flags", t("admin.attendanceColFlags"))}
            <th className={th}>{t("admin.attendanceColMap")}</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((r) => {
            const checkInExtra = r.checkIn ? locationLabel(r.checkIn, t) : null;
            const checkOutExtra = r.checkOut ? locationLabel(r.checkOut, t) : null;
            const workDuration = formatWorkDuration(r.checkIn, r.checkOut, t);
            const workMin = workMinutesOf(r.checkIn, r.checkOut);
            const isUnder = workMin !== null && workMin < STANDARD_WORK_MINUTES;
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
                <td
                  className={`${td} whitespace-nowrap text-[0.875rem] font-medium tabular-nums ${
                    isUnder ? "!text-[var(--apple-red)]" : ""
                  }`}
                  title={
                    isUnder
                      ? t("admin.attendanceWorkUnderTooltip")
                      : undefined
                  }
                >
                  {workDuration ? (
                    isUnder ? (
                      <span className="font-semibold text-[var(--apple-red)]">{workDuration}</span>
                    ) : (
                      workDuration
                    )
                  ) : (
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
