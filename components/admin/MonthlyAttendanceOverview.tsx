"use client";

import { AdminDayAttendanceMap } from "@/components/admin/AdminDayAttendanceMap";
import { useI18n } from "@/components/LanguageProvider";
import type { MonthlyEmployeeRow } from "@/lib/adminMonthlyAttendance";
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
    <section className="mt-8 rounded-xl border border-zinc-200/80 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{t("admin.monthlyTitle")}</h2>
          <p className="mt-1 text-sm text-zinc-500">{t("admin.monthlyLead")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            aria-label={t("admin.monthlyPrev")}
          >
            ‹
          </button>
          <span className="min-w-[7rem] text-center text-sm font-medium text-zinc-900">{monthLabel}</span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            aria-label={t("admin.monthlyNext")}
          >
            ›
          </button>
        </div>
      </div>

      {data && (
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-600">
          <span>
            {t("admin.monthlyEmployees")}: <strong className="text-zinc-900">{data.summary.employeeCount}</strong>
          </span>
          <span>
            {t("admin.monthlyComplete")}: <strong className="text-emerald-700">{data.summary.completeDays}</strong>
          </span>
          <span>
            {t("admin.monthlyPartial")}: <strong className="text-amber-700">{data.summary.partialDays}</strong>
          </span>
          {data.summary.pendingDays > 0 && (
            <span>
              {t("admin.monthlyPending")}: <strong className="text-amber-800">{data.summary.pendingDays}</strong>
            </span>
          )}
          <span className="text-zinc-400">({data.timezone})</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-emerald-100 ring-1 ring-emerald-200" />
          {t("admin.monthlyLegendComplete")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-amber-100 ring-1 ring-amber-200" />
          {t("admin.monthlyLegendPartial")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-zinc-100 ring-1 ring-zinc-200" />
          {t("admin.monthlyLegendEmpty")}
        </span>
      </div>

      {loading && <p className="mt-6 text-sm text-zinc-500">{t("common.loading")}</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {!loading && !error && data && data.rows.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500">{t("admin.monthlyNoEmployees")}</p>
      )}

      {!loading && !error && data && data.rows.length > 0 && (
        <div className="mt-4 -mx-1 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-500">
                <th className="sticky left-0 z-10 min-w-[5.5rem] bg-white px-2 py-2 font-medium">
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
                            ? "rounded bg-sky-100 px-1 py-0.5 font-semibold text-sky-800 ring-1 ring-sky-300"
                            : hasIn
                              ? "rounded px-1 py-0.5 text-zinc-700 hover:bg-sky-50 hover:text-sky-700"
                              : "cursor-default text-zinc-400"
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
                <tr key={row.id} className="border-t border-zinc-50">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1.5 font-medium text-zinc-800">
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
                              ? "inline-flex min-h-[1.75rem] min-w-[1.75rem] touch-manipulation items-center justify-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                              : "inline-flex min-h-[1.75rem] min-w-[1.75rem] items-center justify-center"
                          }
                        >
                        <span
                          className={
                            st === "complete"
                              ? "inline-flex h-7 w-7 items-center justify-center rounded bg-emerald-50 text-[10px] font-medium text-emerald-800 ring-1 ring-emerald-100"
                              : st === "partial"
                                ? "inline-flex h-7 w-7 flex-col items-center justify-center rounded bg-amber-50 text-[9px] leading-tight text-amber-900 ring-1 ring-amber-100"
                                : st === "pending"
                                  ? "inline-flex h-7 w-7 items-center justify-center rounded bg-amber-100 text-[10px] text-amber-900 ring-1 ring-amber-200"
                                  : "inline-flex h-7 w-7 items-center justify-center rounded bg-zinc-50 text-zinc-300"
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
        <p className="text-zinc-500">{t("admin.monthlyMapSelectDay")}</p>
        <div className="flex flex-wrap items-center gap-3">
          {selectedDate && dayHasCheckIn(selectedDayNum ?? 0) && (
            <button
              type="button"
              onClick={() => setMapOpen((v) => !v)}
              className="font-medium text-sky-600 hover:text-sky-700 hover:underline"
            >
              {mapOpen ? t("admin.monthlyMapClose") : t("admin.monthlyViewOnMap")}
              {selectedDate ? ` (${selectedDate})` : ""}
            </button>
          )}
          <Link href="/admin/attendance" className="font-medium text-sky-600 hover:text-sky-700 hover:underline">
            {t("admin.monthlyViewAll")}
          </Link>
        </div>
      </div>

      {mapOpen && selectedDate && (
        <section className="mt-6 rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-zinc-900">
            {t("admin.monthlyMapTitle")} — {selectedDate}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">{t("admin.monthlyMapLead")}</p>
          <AdminDayAttendanceMap key={selectedDate} date={selectedDate} className="mt-4" />
        </section>
      )}
    </section>
  );
}
