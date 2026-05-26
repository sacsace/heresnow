"use client";

import { AttendanceDayTable } from "@/components/admin/attendance/DayTable";
import { groupRowsByEmployee } from "@/components/admin/attendance/helpers";
import { useI18n } from "@/components/LanguageProvider";
import type { AdminAttendanceDayRow } from "@/lib/adminAttendanceByDay";
import { sectionLabel } from "@/lib/uiStyles";
import { useMemo } from "react";

type Props = {
  rows: AdminAttendanceDayRow[];
  dateLocale?: string;
};

export function AttendanceByEmployeeView({ rows, dateLocale }: Props) {
  const { t } = useI18n();
  const groups = useMemo(() => groupRowsByEmployee(rows), [rows]);

  return (
    <div className="space-y-5">
      {groups.map((employeeRows) => {
        const head = employeeRows[0]!;
        const complete = employeeRows.filter((r) => !r.incomplete && r.checkIn && r.checkOut).length;
        const holiday = employeeRows.filter((r) => r.isHolidayWork).length;
        const days = t("admin.attendanceByEmpDays").replace("{n}", String(employeeRows.length));
        return (
          <section key={head.employeeId}>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
              <p className={sectionLabel}>{head.employeeName}</p>
              <p className="text-[0.8125rem] text-[var(--apple-label-secondary)]">
                {days} · {t("admin.attendanceByEmpComplete")} {complete} ·{" "}
                {t("admin.attendanceByEmpHoliday")} {holiday}
              </p>
            </div>
            <AttendanceDayTable rows={employeeRows} showEmployee={false} dateLocale={dateLocale} />
          </section>
        );
      })}
    </div>
  );
}
