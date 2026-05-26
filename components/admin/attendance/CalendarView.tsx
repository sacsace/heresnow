"use client";

import { useI18n } from "@/components/LanguageProvider";
import type { AdminAttendanceDayRow } from "@/lib/adminAttendanceByDay";
import { btnSecondary, sectionLabel } from "@/lib/uiStyles";
import { useMemo } from "react";

type Props = {
  rows: AdminAttendanceDayRow[];
  /** 캘린더가 표시할 월 — "YYYY-MM-DD" 형식, 해당 월의 임의 날짜 */
  month: string;
  dateLocale?: string;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onToday?: () => void;
  onPickDay?: (date: string) => void;
};

type DayAggregate = {
  date: string;
  total: number;
  late: number;
  early: number;
  overtime: number;
  holiday: number;
  pending: number;
  incomplete: number;
  employees: Set<string>;
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * 주어진 월(any date)에 대해 6주 × 7일 = 42칸짜리 격자를 생성한다.
 * 일요일 시작(0=Sun) 기준이며, 앞 뒤 인접 월의 날짜로 채워 정사각 격자를 보장한다.
 */
function buildMonthGrid(monthAnchor: Date): Array<{ date: Date; iso: string; inMonth: boolean }> {
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0..6 (Sun..Sat)
  const start = new Date(year, month, 1 - startOffset);
  const cells: Array<{ date: Date; iso: string; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ date: d, iso: ymd(d), inMonth: d.getMonth() === month });
  }
  return cells;
}

export function AttendanceCalendarView({
  rows,
  month,
  dateLocale,
  onPrevMonth,
  onNextMonth,
  onToday,
  onPickDay,
}: Props) {
  const { t, locale } = useI18n();
  const dl = dateLocale ?? (locale === "en" ? "en-US" : "ko-KR");

  const monthAnchor = useMemo(() => parseYmd(month), [month]);
  const cells = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);
  const todayIso = useMemo(() => ymd(new Date()), []);

  const aggregates = useMemo(() => {
    const map = new Map<string, DayAggregate>();
    for (const r of rows) {
      const agg =
        map.get(r.date) ??
        ({
          date: r.date,
          total: 0,
          late: 0,
          early: 0,
          overtime: 0,
          holiday: 0,
          pending: 0,
          incomplete: 0,
          employees: new Set<string>(),
        } as DayAggregate);
      agg.total += 1;
      if (r.isLate) agg.late += 1;
      if (r.isEarlyLeave) agg.early += 1;
      if (r.isOvertime) agg.overtime += 1;
      if (r.isHolidayWork) agg.holiday += 1;
      if (r.pending) agg.pending += 1;
      if (r.incomplete) agg.incomplete += 1;
      agg.employees.add(r.employeeId);
      map.set(r.date, agg);
    }
    return map;
  }, [rows]);

  const monthLabel = monthAnchor.toLocaleDateString(dl, {
    year: "numeric",
    month: "long",
  });

  // 요일 헤더 — 로케일 기반
  const weekdayHeaders = useMemo(() => {
    const headers: string[] = [];
    // 임의 일요일 (2024-01-07) 기준
    const base = new Date(2024, 0, 7);
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      headers.push(d.toLocaleDateString(dl, { weekday: "short" }));
    }
    return headers;
  }, [dl]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className={`${sectionLabel} mb-0`}>{monthLabel}</p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrevMonth}
            className={`${btnSecondary} h-8 px-2.5 !text-[0.8125rem]`}
            aria-label={t("admin.attendanceCalendarPrev")}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={onToday}
            className={`${btnSecondary} h-8 px-3 !text-[0.8125rem]`}
          >
            {t("admin.attendanceCalendarToday")}
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            className={`${btnSecondary} h-8 px-2.5 !text-[0.8125rem]`}
            aria-label={t("admin.attendanceCalendarNext")}
          >
            ›
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-[var(--grouped-bg)] shadow-sm ring-1 ring-black/[0.04]">
        {/* 요일 헤더 */}
        <div
          className="grid grid-cols-7 border-b border-[var(--separator)] bg-[var(--fill-secondary)]/40"
          role="row"
        >
          {weekdayHeaders.map((label, i) => {
            const isSun = i === 0;
            const isSat = i === 6;
            return (
              <div
                key={i}
                className={`px-2 py-2 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.04em] sm:text-[0.75rem] ${
                  isSun
                    ? "text-[var(--apple-red)]"
                    : isSat
                      ? "text-[var(--apple-blue)]"
                      : "text-[var(--apple-label-secondary)]"
                }`}
                role="columnheader"
              >
                {label}
              </div>
            );
          })}
        </div>

        {/* 날짜 격자 */}
        <div className="grid grid-cols-7" role="grid">
          {cells.map((cell, idx) => {
            const dow = cell.date.getDay();
            const isSun = dow === 0;
            const isSat = dow === 6;
            const isToday = cell.iso === todayIso;
            const agg = aggregates.get(cell.iso);
            const muted = !cell.inMonth;
            const rowEnd = idx >= cells.length - 7;

            const dayNum = cell.date.getDate();

            return (
              <button
                key={cell.iso + idx}
                type="button"
                onClick={() => onPickDay?.(cell.iso)}
                className={`group relative flex min-h-[5.25rem] flex-col items-stretch border-[var(--separator)] px-1.5 py-1.5 text-left transition-colors hover:bg-[var(--fill-secondary)] sm:min-h-[6.5rem] sm:px-2 sm:py-2 ${
                  rowEnd ? "" : "border-b"
                } ${idx % 7 === 6 ? "" : "border-r"} ${
                  muted ? "bg-[var(--fill-secondary)]/30" : ""
                }`}
                aria-label={cell.date.toLocaleDateString(dl, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-[0.75rem] font-semibold sm:text-[0.8125rem] ${
                      isToday
                        ? "bg-[var(--apple-blue)] text-white"
                        : muted
                          ? "text-[var(--apple-label-tertiary)]"
                          : isSun
                            ? "text-[var(--apple-red)]"
                            : isSat
                              ? "text-[var(--apple-blue)]"
                              : "text-[var(--foreground)]"
                    }`}
                  >
                    {dayNum}
                  </span>
                  {agg && agg.total > 0 && (
                    <span className="text-[0.6875rem] font-medium text-[var(--apple-label-secondary)] sm:text-[0.75rem]">
                      {t("admin.attendanceCalendarPersonCount").replace(
                        "{n}",
                        String(agg.employees.size)
                      )}
                    </span>
                  )}
                </div>

                {agg && agg.total > 0 ? (
                  <div className="mt-1 space-y-0.5 text-[0.6875rem] leading-tight sm:text-[0.75rem]">
                    {agg.late > 0 && (
                      <div className="flex items-center gap-1 truncate text-[var(--apple-orange-dark)]">
                        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--apple-orange)]" />
                        <span className="truncate">
                          {t("admin.attendanceCalendarLate").replace("{n}", String(agg.late))}
                        </span>
                      </div>
                    )}
                    {agg.early > 0 && (
                      <div className="flex items-center gap-1 truncate text-[var(--apple-orange-dark)]">
                        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--apple-orange)]" />
                        <span className="truncate">
                          {t("admin.attendanceCalendarEarly").replace("{n}", String(agg.early))}
                        </span>
                      </div>
                    )}
                    {agg.overtime > 0 && (
                      <div className="flex items-center gap-1 truncate text-[var(--apple-blue)]">
                        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--apple-blue)]" />
                        <span className="truncate">
                          {t("admin.attendanceCalendarOvertime").replace("{n}", String(agg.overtime))}
                        </span>
                      </div>
                    )}
                    {agg.holiday > 0 && (
                      <div className="flex items-center gap-1 truncate text-[var(--apple-blue)]">
                        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--apple-blue)]" />
                        <span className="truncate">
                          {t("admin.attendanceCalendarHoliday").replace("{n}", String(agg.holiday))}
                        </span>
                      </div>
                    )}
                    {agg.pending > 0 && (
                      <div className="flex items-center gap-1 truncate text-[var(--apple-label-secondary)]">
                        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--apple-label-secondary)]" />
                        <span className="truncate">
                          {t("admin.attendanceCalendarPending").replace("{n}", String(agg.pending))}
                        </span>
                      </div>
                    )}
                    {agg.incomplete > 0 && (
                      <div className="flex items-center gap-1 truncate text-[var(--apple-red)]">
                        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--apple-red)]" />
                        <span className="truncate">
                          {t("admin.attendanceCalendarIncomplete").replace(
                            "{n}",
                            String(agg.incomplete)
                          )}
                        </span>
                      </div>
                    )}
                    {agg.late === 0 &&
                      agg.early === 0 &&
                      agg.overtime === 0 &&
                      agg.holiday === 0 &&
                      agg.pending === 0 &&
                      agg.incomplete === 0 && (
                        <div className="flex items-center gap-1 truncate text-[var(--apple-green-dark)]">
                          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--apple-green)]" />
                          <span className="truncate">
                            {t("admin.attendanceCalendarNormal")}
                          </span>
                        </div>
                      )}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[0.75rem] text-[var(--apple-label-secondary)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--apple-green)]" />
          {t("admin.attendanceCalendarLegendNormal")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--apple-orange)]" />
          {t("admin.attendanceCalendarLegendIssue")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--apple-red)]" />
          {t("admin.attendanceCalendarLegendIncomplete")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--apple-blue)]" />
          {t("admin.attendanceCalendarLegendOvertime")}
        </span>
      </div>
    </div>
  );
}
