"use client";

import { AdminDayAttendanceMap } from "@/components/admin/AdminDayAttendanceMap";
import { useI18n } from "@/components/LanguageProvider";
import type { MonthlyEmployeeRow } from "@/lib/adminMonthlyAttendance";
import { btnIcon, groupedCard, link, pageSubtitle, sectionLabel } from "@/lib/uiStyles";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type ApiPayload = {
  year: number;
  month: number;
  timezone: string;
  daysInMonth: number;
  summary: {
    employeeCount: number;
    completeDays: number;
    partialDays: number;
    pendingDays: number;
  };
  rows: MonthlyEmployeeRow[];
};

function cellState(d: MonthlyEmployeeRow["days"][number]) {
  if (!d.checkIn && !d.checkOut) return "empty" as const;
  if (d.pending) return "pending" as const;
  if (d.checkIn && d.checkOut && !d.incomplete) return "complete" as const;
  return "partial" as const;
}

export function MonthlyAttendanceOverview() {
  const { t, locale } = useI18n();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await fetch(`/api/admin/dashboard/monthly?year=${year}&month=${month}`);
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) {
      setData(null);
      setError(typeof j.error === "string" ? j.error : t("admin.monthlyLoadFail"));
      return;
    }
    setData(j as ApiPayload);
  }, [year, month, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedDate(null);
    setMapOpen(false);
  }, [year, month]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    setYear(y);
    setMonth(m);
  }

  const monthLabel =
    locale === "en"
      ? new Date(year, month - 1, 1).toLocaleDateString("en-US", { year: "numeric", month: "long" })
      : `${year}년 ${month}월`;

  const dayNums = data ? Array.from({ length: data.daysInMonth }, (_, i) => i + 1) : [];

  const m = String(month).padStart(2, "0");

  function selectDay(day: number) {
    const date = `${year}-${m}-${String(day).padStart(2, "0")}`;
    setSelectedDate(date);
    setMapOpen(true);
  }

  function dayHasCheckIn(day: number): boolean {
    if (!data) return false;
    const date = `${year}-${m}-${String(day).padStart(2, "0")}`;
    return data.rows.some((row) => row.days.some((d) => d.date === date && d.checkIn));
  }

  const selectedDayNum = selectedDate
    ? Number(selectedDate.slice(8, 10))
    : null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <p className={sectionLabel}>{t("admin.monthlyTitle")}</p>
          <p className={pageSubtitle}>{t("admin.monthlyLead")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className={btnIcon}
            aria-label={t("admin.monthlyPrev")}
          >
            ‹
          </button>
          <span className="min-w-[8rem] text-center text-[0.9375rem] font-semibold text-[var(--foreground)]">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className={btnIcon}
            aria-label={t("admin.monthlyNext")}
          >
            ›
          </button>
        </div>
      </div>
      <div className={`${groupedCard} p-4 sm:p-5`}>

      {data && (
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--apple-label-secondary)]">
          <span>
            {t("admin.monthlyEmployees")}: <strong className="text-[var(--foreground)]">{data.summary.employeeCount}</strong>
          </span>
          <span>
            {t("admin.monthlyComplete")}:{" "}
            <strong className="text-[var(--apple-green-dark)]">{data.summary.completeDays}</strong>
          </span>
          <span>
            {t("admin.monthlyPartial")}: <strong className="text-amber-700">{data.summary.partialDays}</strong>
          </span>
          {data.summary.pendingDays > 0 && (
            <span>
              {t("admin.monthlyPending")}: <strong className="text-amber-800">{data.summary.pendingDays}</strong>
            </span>
          )}
          <span className="text-[var(--apple-label-tertiary)]">({data.timezone})</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--apple-label-secondary)]">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[var(--apple-green)]/20 ring-1 ring-[var(--apple-green)]/30" />
          {t("admin.monthlyLegendComplete")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[var(--apple-orange)]/20 ring-1 ring-[var(--apple-orange)]/30" />
          {t("admin.monthlyLegendPartial")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[var(--fill-secondary)] ring-1 ring-[var(--separator)]" />
          {t("admin.monthlyLegendEmpty")}
        </span>
      </div>

      {loading && <p className="mt-6 text-[0.9375rem] text-[var(--apple-label-secondary)]">{t("common.loading")}</p>}
      {error && <p className="mt-6 text-sm text-[var(--apple-red)]">{error}</p>}

      {!loading && !error && data && data.rows.length === 0 && (
        <p className="mt-6 text-[0.9375rem] text-[var(--apple-label-secondary)]">{t("admin.monthlyNoEmployees")}</p>
      )}

      {!loading && !error && data && data.rows.length > 0 && (
        <div className="mt-4 -mx-1 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--separator)] text-[var(--apple-label-secondary)]">
                <th className="sticky left-0 z-10 min-w-[5.5rem] bg-[var(--grouped-bg)] px-2 py-2 font-medium">
                  {t("admin.monthlyColEmployee")}
                </th>
                {dayNums.map((d) => {
                  const dateKey = `${year}-${m}-${String(d).padStart(2, "0")}`;
                  const isSelected = selectedDate === dateKey;
                  const hasIn = dayHasCheckIn(d);
                  return (
                    <th key={d} className="w-9 px-0.5 py-2 text-center font-normal">
                      <button
                        type="button"
                        title={hasIn ? t("admin.monthlyViewOnMap") : undefined}
                        disabled={!hasIn}
                        onClick={() => hasIn && selectDay(d)}
                        className={
                          isSelected
                            ? "rounded-lg bg-[var(--apple-blue)]/14 px-1 py-0.5 font-semibold text-[var(--apple-blue)] ring-1 ring-[var(--apple-blue)]/30"
                            : hasIn
                              ? "rounded-lg px-1 py-0.5 text-[var(--foreground)] hover:bg-[var(--fill-tertiary)]"
                              : "cursor-default text-[var(--apple-label-tertiary)]"
                        }
                      >
                        {d}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--separator)]">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-[var(--grouped-bg)] px-2 py-1.5 font-medium text-[var(--foreground)]">
                    {row.name}
                  </td>
                  {row.days.map((d) => {
                    const st = cellState(d);
                    const title = [
                      d.date,
                      d.checkIn ? `${t("admin.monthlyIn")} ${d.checkIn}` : null,
                      d.checkOut ? `${t("admin.monthlyOut")} ${d.checkOut}` : null,
                    ]
                      .filter(Boolean)
                      .join("\n");
                    const dayNum = Number(d.date.slice(8, 10));
                    const clickable = Boolean(d.checkIn);
                    return (
                      <td key={d.date} className="px-0.5 py-1 text-center" title={title}>
                        <button
                          type="button"
                          disabled={!clickable}
                          onClick={() => clickable && selectDay(dayNum)}
                          className={
                            clickable
                              ? "inline-flex min-h-[1.75rem] min-w-[1.75rem] touch-manipulation items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--apple-blue)]/40"
                              : "inline-flex min-h-[1.75rem] min-w-[1.75rem] items-center justify-center"
                          }
                        >
                        <span
                          className={
                            st === "complete"
                              ? "inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--apple-green)]/12 text-[10px] font-semibold text-[var(--apple-green-dark)] ring-1 ring-[var(--apple-green)]/20"
                              : st === "partial"
                                ? "inline-flex h-7 w-7 flex-col items-center justify-center rounded-lg bg-[var(--apple-orange)]/12 text-[9px] leading-tight text-[var(--apple-orange-dark)] ring-1 ring-[var(--apple-orange)]/20"
                                : st === "pending"
                                  ? "inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--apple-orange)]/20 text-[10px] font-semibold text-[var(--apple-orange-dark)] ring-1 ring-[var(--apple-orange)]/30"
                                  : "inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--fill-tertiary)] text-[var(--apple-label-tertiary)]"
                          }
                        >
                          {st === "complete" && "✓"}
                          {st === "partial" && (
                            <>
                              <span>{d.checkIn ? "출" : "·"}</span>
                              <span>{d.checkOut ? "퇴" : "·"}</span>
                            </>
                          )}
                          {st === "pending" && "!"}
                          {st === "empty" && "·"}
                        </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-[var(--apple-label-secondary)]">{t("admin.monthlyMapSelectDay")}</p>
        <div className="flex flex-wrap items-center gap-3">
          {selectedDate && dayHasCheckIn(selectedDayNum ?? 0) && (
            <button
              type="button"
              onClick={() => setMapOpen((v) => !v)}
              className={link}
            >
              {mapOpen ? t("admin.monthlyMapClose") : t("admin.monthlyViewOnMap")}
              {selectedDate ? ` (${selectedDate})` : ""}
            </button>
          )}
          <Link href="/admin/attendance" className={link}>
            {t("admin.monthlyViewAll")}
          </Link>
        </div>
      </div>

      {mapOpen && selectedDate && (
        <section className="mt-6 rounded-xl bg-[var(--fill-tertiary)] p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            {t("admin.monthlyMapTitle")} — {selectedDate}
          </h3>
          <p className="mt-1 text-xs text-[var(--apple-label-secondary)]">{t("admin.monthlyMapLead")}</p>
          <AdminDayAttendanceMap key={selectedDate} date={selectedDate} className="mt-4" />
        </section>
      )}
      </div>
    </section>
  );
}
