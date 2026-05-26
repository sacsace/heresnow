"use client";

import { chartSeriesFromRows } from "@/components/admin/attendance/helpers";
import { useI18n } from "@/components/LanguageProvider";
import type { AdminAttendanceDayRow } from "@/lib/adminAttendanceByDay";
import { cardBody, groupedCard, sectionLabel } from "@/lib/uiStyles";
import { useMemo } from "react";

type Props = {
  rows: AdminAttendanceDayRow[];
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={`${groupedCard} ${cardBody} min-w-[7rem] flex-1`}>
      <p className="text-[0.8125rem] text-[var(--apple-label-secondary)]">{label}</p>
      <p className="mt-1 text-[1.375rem] font-semibold tabular-nums text-[var(--foreground)]">{value}</p>
    </div>
  );
}

export function AttendanceChartView({ rows }: Props) {
  const { t } = useI18n();
  const stats = useMemo(() => {
    const checkIns = rows.filter((r) => r.checkIn).length;
    const complete = rows.filter((r) => r.checkIn && r.checkOut && !r.incomplete).length;
    const incomplete = rows.filter((r) => r.incomplete).length;
    const holiday = rows.filter((r) => r.isHolidayWork).length;
    const late = rows.filter((r) => r.isLate).length;
    const employees = new Set(rows.map((r) => r.employeeId)).size;
    return { checkIns, complete, incomplete, holiday, late, employees };
  }, [rows]);

  const series = useMemo(() => chartSeriesFromRows(rows, 14), [rows]);
  const maxCount = Math.max(1, ...series.map((s) => s.count));

  const employeeBars = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const row of rows) {
      if (!row.checkIn) continue;
      const cur = map.get(row.employeeId) ?? { id: row.employeeId, name: row.employeeName, count: 0 };
      cur.count += 1;
      map.set(row.employeeId, cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [rows]);
  const maxEmp = Math.max(1, ...employeeBars.map((e) => e.count));

  const countSuffix = t("admin.statCount");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <StatCard label={t("admin.statCheckIns")} value={stats.checkIns} />
        <StatCard label={t("admin.statComplete")} value={stats.complete} />
        <StatCard label={t("admin.statIncomplete")} value={stats.incomplete} />
        <StatCard label={t("admin.statHoliday")} value={stats.holiday} />
        <StatCard label={t("admin.statLate")} value={stats.late} />
        <StatCard label={t("admin.statEmployees")} value={stats.employees} />
      </div>

      <section>
        <p className={sectionLabel}>{t("admin.statRecent14Days")}</p>
        <div className={`${groupedCard} ${cardBody}`}>
          {series.length === 0 ? (
            <p className="text-[0.9375rem] text-[var(--apple-label-tertiary)]">{t("admin.statNoData")}</p>
          ) : (
            <div className="flex h-40 items-end gap-1.5 sm:gap-2">
              {series.map((s) => (
                <div
                  key={s.date}
                  className="flex min-w-0 flex-1 flex-col items-center gap-2"
                  title={`${s.date}: ${s.count}${countSuffix}`}
                >
                  <span className="text-[0.6875rem] font-medium tabular-nums text-[var(--apple-label-secondary)]">
                    {s.count}
                  </span>
                  <div
                    className="w-full max-w-[2.5rem] rounded-t-md bg-[var(--apple-blue)]"
                    style={{ height: `${Math.max(8, (s.count / maxCount) * 100)}%` }}
                  />
                  <span className="text-[0.625rem] text-[var(--apple-label-tertiary)]">{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <p className={sectionLabel}>{t("admin.statByEmployee")}</p>
        <div className={`${groupedCard} ${cardBody} space-y-3`}>
          {employeeBars.length === 0 ? (
            <p className="text-[0.9375rem] text-[var(--apple-label-tertiary)]">{t("admin.statNoData")}</p>
          ) : (
            employeeBars.map((e) => (
              <div key={e.id} className="grid grid-cols-[6rem_1fr_2rem] items-center gap-3 sm:grid-cols-[8rem_1fr_2rem]">
                <span className="truncate text-[0.875rem] font-medium text-[var(--foreground)]">{e.name}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--fill-secondary)]">
                  <div
                    className="h-full rounded-full bg-[var(--apple-blue)]"
                    style={{ width: `${(e.count / maxEmp) * 100}%` }}
                  />
                </div>
                <span className="text-right text-[0.8125rem] tabular-nums text-[var(--apple-label-secondary)]">
                  {e.count}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
