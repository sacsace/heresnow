"use client";

import { AttendanceDayTable } from "@/components/admin/attendance/DayTable";
import { groupRowsByEmployee } from "@/components/admin/attendance/helpers";
import type { AdminAttendanceDayRow } from "@/lib/adminAttendanceByDay";
import { sectionLabel } from "@/lib/uiStyles";
import { useMemo } from "react";

type Props = {
  rows: AdminAttendanceDayRow[];
  dateLocale?: string;
};

export function AttendanceByEmployeeView({ rows, dateLocale = "ko-KR" }: Props) {
  const groups = useMemo(() => groupRowsByEmployee(rows), [rows]);

  return (
    <div className="space-y-5">
      {groups.map((employeeRows) => {
        const head = employeeRows[0]!;
        const complete = employeeRows.filter((r) => !r.incomplete && r.checkIn && r.checkOut).length;
        const holiday = employeeRows.filter((r) => r.isHolidayWork).length;
        return (
          <section key={head.employeeId}>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
              <p className={sectionLabel}>{head.employeeName}</p>
              <p className="text-[0.8125rem] text-[var(--apple-label-secondary)]">
                {employeeRows.length}일 · 출·퇴 완료 {complete} · 휴일근무 {holiday}
              </p>
            </div>
            <AttendanceDayTable rows={employeeRows} showEmployee={false} dateLocale={dateLocale} />
          </section>
        );
      })}
    </div>
  );
}
