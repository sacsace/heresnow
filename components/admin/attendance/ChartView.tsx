"use client";

import { useI18n } from "@/components/LanguageProvider";
import type { AdminAttendanceDayRow } from "@/lib/adminAttendanceByDay";
import { cardBody, cardBodyCompact, groupedCard, sectionLabel, sectionLabelCompact, statCardCompact } from "@/lib/uiStyles";
import { useMemo } from "react";

type Props = {
  rows: AdminAttendanceDayRow[];
  fromDate?: string;
  toDate?: string;
  dateLocale?: string;
  /** 요약·차트 패딩·간격 축소 */
  compact?: boolean;
};

type StatTone = "neutral" | "positive" | "warning" | "danger" | "info";

function StatCard({
  label,
  value,
  tone = "neutral",
  hint,
  compact = false,
}: {
  label: string;
  value: string | number;
  tone?: StatTone;
  hint?: string;
  compact?: boolean;
}) {
  const valueColor =
    tone === "positive"
      ? "text-[var(--apple-green-dark)]"
      : tone === "warning"
        ? "text-[var(--apple-orange-dark)]"
        : tone === "danger"
          ? "text-[var(--apple-red)]"
          : tone === "info"
            ? "text-[var(--apple-blue)]"
            : "text-[var(--foreground)]";

  if (compact) {
    return (
      <div className={statCardCompact}>
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <p className="min-w-0 truncate text-[0.6875rem] font-medium leading-tight text-[var(--apple-label-secondary)] sm:text-[0.75rem]">
            {label}
          </p>
          <p className={`shrink-0 text-[1.0625rem] font-semibold tabular-nums leading-none sm:text-[1.125rem] ${valueColor}`}>
            {value}
          </p>
        </div>
        {hint && (
          <p className="mt-0.5 truncate text-[0.6875rem] text-[var(--apple-label-tertiary)]">{hint}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`${groupedCard} ${cardBody} min-w-0`}>
      <p className="truncate text-[0.75rem] font-medium uppercase tracking-[0.04em] text-[var(--apple-label-secondary)] sm:text-[0.8125rem]">
        {label}
      </p>
      <p className={`mt-1.5 text-[1.5rem] font-semibold tabular-nums leading-none sm:text-[1.75rem] ${valueColor}`}>
        {value}
      </p>
      {hint && (
        <p className="mt-1 truncate text-[0.75rem] text-[var(--apple-label-tertiary)]">{hint}</p>
      )}
    </div>
  );
}

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

/** 두 날짜 사이의 일별 시리즈를 만든다 (0인 날도 포함). 최대 62일로 제한 */
function buildDailyRange(fromDate: string, toDate: string): string[] {
  const out: string[] = [];
  const from = parseYmd(fromDate);
  const to = parseYmd(toDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return out;
  const cursor = new Date(from);
  let guard = 0;
  while (cursor.getTime() <= to.getTime() && guard < 62) {
    out.push(ymd(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return out;
}

export function AttendanceChartView({ rows, fromDate, toDate, dateLocale, compact = false }: Props) {
  const { t, locale } = useI18n();
  const dl = dateLocale ?? (locale === "en" ? "en-US" : "ko-KR");
  const sectionCls = compact ? sectionLabelCompact : sectionLabel;
  const bodyCls = compact ? cardBodyCompact : cardBody;
  const stackGap = compact ? "space-y-4" : "space-y-7";
  const statGridCls = compact
    ? "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
    : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";

  // ---------- 요약 카드 ----------
  const stats = useMemo(() => {
    const checkIns = rows.filter((r) => r.checkIn).length;
    const complete = rows.filter((r) => r.checkIn && r.checkOut && !r.incomplete).length;
    const incomplete = rows.filter((r) => r.incomplete).length;
    const holiday = rows.filter((r) => r.isHolidayWork).length;
    const late = rows.filter((r) => r.isLate).length;
    const early = rows.filter((r) => r.isEarlyLeave).length;
    const overtime = rows.filter((r) => r.isOvertime).length;
    const employees = new Set(rows.map((r) => r.employeeId)).size;
    const completionRate = checkIns > 0 ? Math.round((complete / checkIns) * 100) : 0;
    const ontime = checkIns > 0 ? Math.max(0, checkIns - late) : 0;
    const punctualityRate = checkIns > 0 ? Math.round((ontime / checkIns) * 100) : 0;
    return {
      checkIns,
      complete,
      incomplete,
      holiday,
      late,
      early,
      overtime,
      employees,
      completionRate,
      punctualityRate,
    };
  }, [rows]);

  // ---------- 일별 추이 (선택 기간 전체) ----------
  const dailySeries = useMemo(() => {
    const counts = new Map<string, { count: number; late: number; incomplete: number }>();
    for (const row of rows) {
      if (!row.checkIn) continue;
      const cur = counts.get(row.date) ?? { count: 0, late: 0, incomplete: 0 };
      cur.count += 1;
      if (row.isLate) cur.late += 1;
      if (row.incomplete) cur.incomplete += 1;
      counts.set(row.date, cur);
    }
    const range =
      fromDate && toDate
        ? buildDailyRange(fromDate, toDate)
        : [...counts.keys()].sort();
    return range.map((date) => {
      const c = counts.get(date) ?? { count: 0, late: 0, incomplete: 0 };
      return {
        date,
        count: c.count,
        late: c.late,
        incomplete: c.incomplete,
      };
    });
  }, [rows, fromDate, toDate]);

  const maxDailyCount = Math.max(1, ...dailySeries.map((s) => s.count));

  // ---------- 상태 분포 ----------
  const statusBreakdown = useMemo(() => {
    let normal = 0;
    let late = 0;
    let early = 0;
    let overtime = 0;
    let holiday = 0;
    let incomplete = 0;
    for (const r of rows) {
      if (r.incomplete) {
        incomplete += 1;
        continue;
      }
      if (r.isHolidayWork) {
        holiday += 1;
        continue;
      }
      if (r.isLate) late += 1;
      else if (r.isEarlyLeave) early += 1;
      else if (r.isOvertime) overtime += 1;
      else normal += 1;
    }
    const total = normal + late + early + overtime + holiday + incomplete;
    return { normal, late, early, overtime, holiday, incomplete, total };
  }, [rows]);

  // ---------- 요일별 출근 ----------
  const dowDistribution = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0, 0, 0];
    for (const r of rows) {
      if (!r.checkIn) continue;
      const d = parseYmd(r.date);
      buckets[d.getDay()] = (buckets[d.getDay()] ?? 0) + 1;
    }
    // 일~토 순 헤더 (로케일 기준)
    const labels: string[] = [];
    const base = new Date(2024, 0, 7);
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      labels.push(d.toLocaleDateString(dl, { weekday: "short" }));
    }
    return buckets.map((count, dow) => ({ dow, label: labels[dow] ?? "", count }));
  }, [rows, dl]);

  const maxDow = Math.max(1, ...dowDistribution.map((d) => d.count));

  // ---------- 직원별 출근 (상위 10명) ----------
  const employeeBars = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; count: number; late: number; incomplete: number }
    >();
    for (const row of rows) {
      if (!row.checkIn) continue;
      const cur =
        map.get(row.employeeId) ??
        { id: row.employeeId, name: row.employeeName, count: 0, late: 0, incomplete: 0 };
      cur.count += 1;
      if (row.isLate) cur.late += 1;
      if (row.incomplete) cur.incomplete += 1;
      map.set(row.employeeId, cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [rows]);
  const maxEmp = Math.max(1, ...employeeBars.map((e) => e.count));

  const countSuffix = t("admin.statCount");

  function formatTooltipDate(date: string): string {
    return parseYmd(date).toLocaleDateString(dl, {
      month: "short",
      day: "numeric",
      weekday: "short",
    });
  }

  function formatAxisLabel(date: string): string {
    return parseYmd(date).toLocaleDateString(dl, { month: "numeric", day: "numeric" });
  }

  // 너무 많을 때는 X축 라벨을 건너뛰어 표시
  const labelStride = dailySeries.length > 21 ? Math.ceil(dailySeries.length / 14) : 1;

  return (
    <div className={stackGap}>
      {/* ---------- 요약 카드 (반응형 그리드) ---------- */}
      <div className={statGridCls}>
        <StatCard compact={compact} label={t("admin.statCheckIns")} value={stats.checkIns} />
        <StatCard compact={compact} label={t("admin.statComplete")} value={stats.complete} tone="positive" />
        <StatCard
          compact={compact}
          label={t("admin.statCompletionRate")}
          value={`${stats.completionRate}%`}
          tone={stats.completionRate >= 90 ? "positive" : stats.completionRate >= 70 ? "neutral" : "warning"}
        />
        <StatCard
          compact={compact}
          label={t("admin.statPunctualityRate")}
          value={`${stats.punctualityRate}%`}
          tone={stats.punctualityRate >= 95 ? "positive" : stats.punctualityRate >= 80 ? "neutral" : "warning"}
        />
        <StatCard
          compact={compact}
          label={t("admin.statLate")}
          value={stats.late}
          tone={stats.late > 0 ? "warning" : "neutral"}
        />
        <StatCard
          compact={compact}
          label={t("admin.statEarlyLeave")}
          value={stats.early}
          tone={stats.early > 0 ? "warning" : "neutral"}
        />
        <StatCard
          compact={compact}
          label={t("admin.statIncomplete")}
          value={stats.incomplete}
          tone={stats.incomplete > 0 ? "danger" : "neutral"}
        />
        <StatCard compact={compact} label={t("admin.statHoliday")} value={stats.holiday} tone={stats.holiday > 0 ? "info" : "neutral"} />
        <StatCard compact={compact} label={t("admin.statOvertime")} value={stats.overtime} tone={stats.overtime > 0 ? "info" : "neutral"} />
        <StatCard compact={compact} label={t("admin.statEmployees")} value={stats.employees} />
      </div>

      {/* ---------- 상태 분포 (가로 누적 막대) ---------- */}
      <section>
        <p className={sectionCls}>{t("admin.statStatusBreakdown")}</p>
        <div className={`${groupedCard} ${bodyCls} space-y-2.5`}>
          {statusBreakdown.total === 0 ? (
            <p className="text-[0.9375rem] text-[var(--apple-label-tertiary)]">
              {t("admin.statNoData")}
            </p>
          ) : (
            <>
              <div
                className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--fill-secondary)]"
                role="img"
                aria-label={t("admin.statStatusBreakdown")}
              >
                {statusBreakdown.normal > 0 && (
                  <div
                    className="h-full bg-[var(--apple-green)]"
                    style={{ width: `${(statusBreakdown.normal / statusBreakdown.total) * 100}%` }}
                    title={`${t("admin.statBdNormal")}: ${statusBreakdown.normal}`}
                  />
                )}
                {statusBreakdown.late > 0 && (
                  <div
                    className="h-full bg-[var(--apple-orange)]"
                    style={{ width: `${(statusBreakdown.late / statusBreakdown.total) * 100}%` }}
                    title={`${t("admin.statBdLate")}: ${statusBreakdown.late}`}
                  />
                )}
                {statusBreakdown.early > 0 && (
                  <div
                    className="h-full"
                    style={{
                      width: `${(statusBreakdown.early / statusBreakdown.total) * 100}%`,
                      backgroundColor: "rgba(255, 149, 0, 0.6)",
                    }}
                    title={`${t("admin.statBdEarly")}: ${statusBreakdown.early}`}
                  />
                )}
                {statusBreakdown.overtime > 0 && (
                  <div
                    className="h-full bg-[var(--apple-blue)]"
                    style={{ width: `${(statusBreakdown.overtime / statusBreakdown.total) * 100}%` }}
                    title={`${t("admin.statBdOvertime")}: ${statusBreakdown.overtime}`}
                  />
                )}
                {statusBreakdown.holiday > 0 && (
                  <div
                    className="h-full"
                    style={{
                      width: `${(statusBreakdown.holiday / statusBreakdown.total) * 100}%`,
                      backgroundColor: "rgba(0, 122, 255, 0.55)",
                    }}
                    title={`${t("admin.statBdHoliday")}: ${statusBreakdown.holiday}`}
                  />
                )}
                {statusBreakdown.incomplete > 0 && (
                  <div
                    className="h-full bg-[var(--apple-red)]"
                    style={{ width: `${(statusBreakdown.incomplete / statusBreakdown.total) * 100}%` }}
                    title={`${t("admin.statBdIncomplete")}: ${statusBreakdown.incomplete}`}
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem] text-[var(--apple-label-secondary)]">
                {statusBreakdown.normal > 0 && (
                  <LegendDot color="var(--apple-green)" label={t("admin.statBdNormal")} value={statusBreakdown.normal} total={statusBreakdown.total} />
                )}
                {statusBreakdown.late > 0 && (
                  <LegendDot color="var(--apple-orange)" label={t("admin.statBdLate")} value={statusBreakdown.late} total={statusBreakdown.total} />
                )}
                {statusBreakdown.early > 0 && (
                  <LegendDot color="rgba(255, 149, 0, 0.6)" label={t("admin.statBdEarly")} value={statusBreakdown.early} total={statusBreakdown.total} />
                )}
                {statusBreakdown.overtime > 0 && (
                  <LegendDot color="var(--apple-blue)" label={t("admin.statBdOvertime")} value={statusBreakdown.overtime} total={statusBreakdown.total} />
                )}
                {statusBreakdown.holiday > 0 && (
                  <LegendDot color="rgba(0, 122, 255, 0.55)" label={t("admin.statBdHoliday")} value={statusBreakdown.holiday} total={statusBreakdown.total} />
                )}
                {statusBreakdown.incomplete > 0 && (
                  <LegendDot color="var(--apple-red)" label={t("admin.statBdIncomplete")} value={statusBreakdown.incomplete} total={statusBreakdown.total} />
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ---------- 일별 추이 ---------- */}
      <section>
        <p className={sectionCls}>{t("admin.statDailyTrend")}</p>
        <div className={`${groupedCard} ${bodyCls}`}>
          {dailySeries.length === 0 ? (
            <p className="text-[0.9375rem] text-[var(--apple-label-tertiary)]">
              {t("admin.statNoData")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div
                className={`flex items-end gap-1 ${compact ? "h-36" : "h-44"} sm:gap-1.5`}
                style={{ minWidth: `${Math.max(dailySeries.length * 28, 100)}px` }}
              >
                {dailySeries.map((s, i) => {
                  const isWeekend = (() => {
                    const d = parseYmd(s.date);
                    const dow = d.getDay();
                    return dow === 0 || dow === 6;
                  })();
                  const barColor =
                    s.incomplete > 0
                      ? "bg-[var(--apple-red)]"
                      : s.late > 0
                        ? "bg-[var(--apple-orange)]"
                        : "bg-[var(--apple-blue)]";
                  return (
                    <div
                      key={s.date}
                      className="flex min-w-0 flex-1 flex-col items-center gap-1"
                      title={`${formatTooltipDate(s.date)}: ${s.count}${countSuffix}${s.late > 0 ? ` · ${t("admin.attendanceFlagLate")} ${s.late}` : ""}${s.incomplete > 0 ? ` · ${t("admin.attendanceIncomplete")} ${s.incomplete}` : ""}`}
                    >
                      <span
                        className={`text-[0.625rem] font-medium tabular-nums sm:text-[0.6875rem] ${
                          s.count === 0 ? "opacity-0" : "text-[var(--apple-label-secondary)]"
                        }`}
                      >
                        {s.count}
                      </span>
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className={`w-full rounded-t-md transition-colors ${barColor} ${s.count === 0 ? "opacity-0" : ""}`}
                          style={{
                            height: s.count === 0 ? "2px" : `${(s.count / maxDailyCount) * 100}%`,
                            minHeight: s.count > 0 ? "4px" : undefined,
                          }}
                        />
                      </div>
                      <span
                        className={`text-[0.625rem] tabular-nums ${
                          isWeekend
                            ? parseYmd(s.date).getDay() === 0
                              ? "text-[var(--apple-red)]"
                              : "text-[var(--apple-blue)]"
                            : "text-[var(--apple-label-tertiary)]"
                        }`}
                      >
                        {i % labelStride === 0 ? formatAxisLabel(s.date) : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---------- 요일별 출근 ---------- */}
      <section>
        <p className={sectionCls}>{t("admin.statByDow")}</p>
        <div className={`${groupedCard} ${bodyCls}`}>
          {stats.checkIns === 0 ? (
            <p className="text-[0.9375rem] text-[var(--apple-label-tertiary)]">
              {t("admin.statNoData")}
            </p>
          ) : (
            <div className={`grid grid-cols-7 ${compact ? "gap-1.5" : "gap-2 sm:gap-3"}`}>
              {dowDistribution.map((d) => {
                const isSun = d.dow === 0;
                const isSat = d.dow === 6;
                const heightPct = (d.count / maxDow) * 100;
                return (
                  <div
                    key={d.dow}
                    className="flex flex-col items-center gap-0.5"
                    title={`${d.label}: ${d.count}${countSuffix}`}
                  >
                    <span className="text-[0.6875rem] font-medium tabular-nums text-[var(--apple-label-secondary)] sm:text-[0.75rem]">
                      {d.count}
                    </span>
                    <div className={`flex w-full items-end justify-center ${compact ? "h-20" : "h-24 sm:h-28"}`}>
                      <div
                        className={`w-full max-w-[2rem] rounded-md ${
                          isSun
                            ? "bg-[var(--apple-red)]"
                            : isSat
                              ? "bg-[var(--apple-blue)]"
                              : "bg-[var(--apple-blue)]"
                        }`}
                        style={{ height: `${Math.max(d.count > 0 ? 4 : 0, heightPct)}%` }}
                      />
                    </div>
                    <span
                      className={`text-[0.6875rem] sm:text-[0.75rem] ${
                        isSun
                          ? "text-[var(--apple-red)]"
                          : isSat
                            ? "text-[var(--apple-blue)]"
                            : "text-[var(--apple-label-tertiary)]"
                      }`}
                    >
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ---------- 직원별 출근 (상위 10명) ---------- */}
      <section>
        <p className={sectionCls}>{t("admin.statByEmployee")}</p>
        <div className={`${groupedCard} ${bodyCls} ${compact ? "space-y-2" : "space-y-3"}`}>
          {employeeBars.length === 0 ? (
            <p className="text-[0.9375rem] text-[var(--apple-label-tertiary)]">
              {t("admin.statNoData")}
            </p>
          ) : (
            employeeBars.map((e) => {
                const onTimeRatio = e.count > 0 ? (e.count - e.late) / e.count : 1;
                const issueRatio = e.count > 0 ? e.late / e.count : 0;
                return (
                  <div
                    key={e.id}
                    className={`grid grid-cols-[6rem_1fr_4rem] items-center ${compact ? "gap-2" : "gap-3"} sm:grid-cols-[10rem_1fr_5rem]`}
                    title={`${e.name}: ${e.count}${countSuffix}${e.late > 0 ? ` · ${t("admin.attendanceFlagLate")} ${e.late}` : ""}`}
                  >
                    <span className="truncate text-[0.875rem] font-medium text-[var(--foreground)]">
                      {e.name}
                    </span>
                    <div className="relative flex h-2.5 overflow-hidden rounded-full bg-[var(--fill-secondary)]">
                      <div
                        className="h-full bg-[var(--apple-blue)]"
                        style={{ width: `${onTimeRatio * (e.count / maxEmp) * 100}%` }}
                      />
                      {issueRatio > 0 && (
                        <div
                          className="h-full bg-[var(--apple-orange)]"
                          style={{ width: `${issueRatio * (e.count / maxEmp) * 100}%` }}
                        />
                      )}
                    </div>
                    <span className="text-right text-[0.8125rem] tabular-nums text-[var(--apple-label-secondary)]">
                      {e.count}
                      {e.late > 0 && (
                        <span className="ml-1 text-[var(--apple-orange-dark)]">/{e.late}</span>
                      )}
                    </span>
                  </div>
                );
              })
          )}
          {employeeBars.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--separator)] pt-2.5 text-[0.75rem] text-[var(--apple-label-secondary)]">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--apple-blue)]"
                  aria-hidden
                />
                {t("admin.statByEmployeeLegendOnTime")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--apple-orange)]"
                  aria-hidden
                />
                {t("admin.statByEmployeeLegendLate")}
              </span>
              <span className="text-[var(--apple-label-tertiary)]">
                {t("admin.statByEmployeeLegendCount")}
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function LegendDot({
  color,
  label,
  value,
  total,
}: {
  color: string;
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="tabular-nums">
        {label} <span className="text-[var(--apple-label-tertiary)]">{value} ({pct}%)</span>
      </span>
    </span>
  );
}
