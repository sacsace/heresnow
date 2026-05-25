"use client";

import { AttendanceByEmployeeView } from "@/components/admin/attendance/ByEmployeeView";
import { AttendanceChartView } from "@/components/admin/attendance/ChartView";
import { AttendanceDayTable } from "@/components/admin/attendance/DayTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { useI18n } from "@/components/LanguageProvider";
import type { AdminAttendanceDayRow } from "@/lib/adminAttendanceByDay";
import {
  btnPrimary,
  btnSecondary,
  emptyState,
  groupedCard,
  inputCompact,
  label,
  pageStack,
  searchFieldWrap,
  searchToolbar,
  segmentedBtn,
  segmentedWrap,
  selectSm,
  tableToolbar,
} from "@/lib/uiStyles";
import { useCallback, useEffect, useMemo, useState } from "react";

type AttendanceTab = "daily" | "byEmployee" | "holiday" | "chart";

type SearchFilters = {
  q: string;
  from: string;
  to: string;
  status: string;
};

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const mm = String(month + 1).padStart(2, "0");
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function defaultFilters(): SearchFilters {
  const { from, to } = currentMonthRange();
  return { q: "", from, to, status: "" };
}

function filtersDifferFromDefault(f: SearchFilters): boolean {
  const d = defaultFilters();
  return f.q !== d.q || f.from !== d.from || f.to !== d.to || f.status !== d.status;
}

export default function AdminAttendancePage() {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<AdminAttendanceDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AttendanceTab>("daily");
  const [draft, setDraft] = useState<SearchFilters>(() => defaultFilters());
  const [filters, setFilters] = useState<SearchFilters>(() => defaultFilters());

  const dateLocale = locale === "en" ? "en-US" : "ko-KR";

  const tabs: { id: AttendanceTab; label: string }[] = [
    { id: "daily", label: t("admin.attendanceTabDaily") },
    { id: "byEmployee", label: t("admin.attendanceTabByEmployee") },
    { id: "holiday", label: t("admin.attendanceTabHoliday") },
    { id: "chart", label: t("admin.attendanceTabChart") },
  ];

  const subtitleByTab: Record<AttendanceTab, string> = {
    daily: t("admin.attendanceTabDailyLead"),
    byEmployee: t("admin.attendanceTabByEmployeeLead"),
    holiday: t("admin.attendanceTabHolidayLead"),
    chart: t("admin.attendanceTabChartLead"),
  };

  const exportHref = useMemo(() => {
    const q = new URLSearchParams();
    if (filters.status) q.set("status", filters.status);
    if (filters.from) q.set("from", filters.from);
    if (filters.to) q.set("to", filters.to);
    if (filters.q) q.set("q", filters.q);
    const s = q.toString();
    return s ? `/api/admin/export?${s}` : "/api/admin/export";
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (filters.status) q.set("status", filters.status);
    if (filters.from) q.set("from", filters.from);
    if (filters.to) q.set("to", filters.to);
    if (filters.q) q.set("q", filters.q);
    const r = await fetch(`/api/admin/attendance?${q.toString()}`);
    const j = await r.json();
    if (r.ok) setRows(j.days ?? []);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters({ ...draft });
  }

  function resetSearch() {
    const next = defaultFilters();
    setDraft(next);
    setFilters(next);
  }

  const holidayRows = useMemo(() => rows.filter((r) => r.isHolidayWork), [rows]);
  const displayRows = tab === "holiday" ? holidayRows : rows;
  const hasActiveFilters = filtersDifferFromDefault(filters);

  return (
    <div className={pageStack}>
      <PageHeader title={t("admin.attendanceTitle")} subtitle={subtitleByTab[tab]} />

      <div className={`max-w-full overflow-x-auto ${segmentedWrap}`}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={segmentedBtn(tab === item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={groupedCard}>
        <form onSubmit={applySearch} className={tableToolbar}>
          <div className={searchToolbar}>
            <div className={searchFieldWrap}>
              <label className={label} htmlFor="attendance-search-name">
                {t("admin.attendanceSearchName")}
              </label>
              <input
                id="attendance-search-name"
                type="search"
                className={`${inputCompact} mt-1.5`}
                placeholder={t("admin.attendanceSearchNamePlaceholder")}
                value={draft.q}
                onChange={(e) => setDraft((prev) => ({ ...prev, q: e.target.value }))}
              />
            </div>
            <div className="min-w-0 w-full sm:w-auto">
              <label className={label} htmlFor="attendance-from">
                {t("admin.attendanceDateFrom")}
              </label>
              <input
                id="attendance-from"
                type="date"
                className={`${inputCompact} mt-1.5 sm:min-w-[10rem]`}
                value={draft.from}
                onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value }))}
              />
            </div>
            <div className="min-w-0 w-full sm:w-auto">
              <label className={label} htmlFor="attendance-to">
                {t("admin.attendanceDateTo")}
              </label>
              <input
                id="attendance-to"
                type="date"
                className={`${inputCompact} mt-1.5 sm:min-w-[10rem]`}
                value={draft.to}
                onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
              />
            </div>
            <div className="min-w-0 w-full sm:w-auto">
              <label className={label} htmlFor="attendance-status">
                {t("admin.attendanceFilterStatus")}
              </label>
              <select
                id="attendance-status"
                className={`${selectSm} mt-1.5`}
                value={draft.status}
                onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="">{t("admin.attendanceFilterAll")}</option>
                <option value="APPROVED">APPROVED</option>
                <option value="PENDING">PENDING</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
            <div className="flex shrink-0 flex-wrap items-end gap-2">
              <button type="submit" className={`${btnPrimary} h-9 px-4`}>
                {t("admin.attendanceSearchApply")}
              </button>
              {hasActiveFilters && (
                <button type="button" onClick={resetSearch} className={`${btnSecondary} h-9 px-4`}>
                  {t("admin.attendanceSearchReset")}
                </button>
              )}
              <a href={exportHref} className={`${btnSecondary} h-9 px-4 !text-[0.875rem]`}>
                Excel
              </a>
            </div>
          </div>
        </form>
      </div>

      {loading ? (
        <p className="text-[1rem] text-[var(--apple-label-secondary)]">{t("common.loading")}</p>
      ) : tab === "chart" ? (
        rows.length === 0 ? (
          <p className={emptyState}>{t("admin.attendanceEmpty")}</p>
        ) : (
          <AttendanceChartView rows={rows} />
        )
      ) : displayRows.length === 0 ? (
        <p className={emptyState}>{t("admin.attendanceEmpty")}</p>
      ) : tab === "byEmployee" ? (
        <AttendanceByEmployeeView rows={displayRows} dateLocale={dateLocale} />
      ) : (
        <AttendanceDayTable rows={displayRows} dateLocale={dateLocale} />
      )}
    </div>
  );
}
