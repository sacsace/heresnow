"use client";

import { AdminDayAttendanceMap } from "@/components/admin/AdminDayAttendanceMap";
import { AttendanceByEmployeeView } from "@/components/admin/attendance/ByEmployeeView";
import { CalendarDayDetailModal } from "@/components/admin/attendance/CalendarDayDetailModal";
import { AttendanceCalendarView } from "@/components/admin/attendance/CalendarView";
import { AttendanceChartView } from "@/components/admin/attendance/ChartView";
import { AttendanceDayTable } from "@/components/admin/attendance/DayTable";
import { AttendanceDownloadView } from "@/components/admin/attendance/DownloadView";
import { AttendanceIssuesView } from "@/components/admin/attendance/IssuesView";
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
  searchActions,
  searchFieldCol,
  searchFiltersRow,
  segmentedBtn,
  segmentedWrap,
  selectSm,
  tableToolbar,
} from "@/lib/uiStyles";
import { useCallback, useEffect, useMemo, useState } from "react";

type AttendanceTab =
  | "byEmployee"
  | "holiday"
  | "calendar"
  | "chart"
  | "map"
  | "issues"
  | "download";

type SearchFilters = {
  q: string;
  from: string;
  to: string;
  status: string;
  departmentId: string;
};

type DepartmentLite = { id: string; name: string };

function monthRangeFor(year: number, month: number): { from: string; to: string } {
  const mm = String(month + 1).padStart(2, "0");
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  return monthRangeFor(now.getFullYear(), now.getMonth());
}

function previousMonthRange(): { from: string; to: string } {
  const now = new Date();
  return monthRangeFor(now.getFullYear(), now.getMonth() - 1);
}

function endOfMonthYmd(ymd: string): string {
  const d = parseYmd(ymd);
  return monthRangeFor(d.getFullYear(), d.getMonth()).to;
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y ?? new Date().getFullYear(), (m ?? 1) - 1, d ?? 1);
}

function monthRangeFromAnchor(ymd: string): { from: string; to: string } {
  const d = parseYmd(ymd);
  return monthRangeFor(d.getFullYear(), d.getMonth());
}

function shiftCalendarMonth(anchorYmd: string, delta: number): string {
  const base = parseYmd(anchorYmd);
  base.setMonth(base.getMonth() + delta);
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  return `${base.getFullYear()}-${mm}-01`;
}

function defaultFilters(): SearchFilters {
  const { from, to } = previousMonthRange();
  return { q: "", from, to, status: "", departmentId: "" };
}

function filtersDifferFromDefault(f: SearchFilters): boolean {
  const d = defaultFilters();
  return (
    f.q !== d.q ||
    f.from !== d.from ||
    f.to !== d.to ||
    f.status !== d.status ||
    f.departmentId !== d.departmentId
  );
}

export default function AdminAttendancePage() {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<AdminAttendanceDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AttendanceTab>("byEmployee");
  const [draft, setDraft] = useState<SearchFilters>(() => defaultFilters());
  const [filters, setFilters] = useState<SearchFilters>(() => defaultFilters());
  /** 월 달력 탭 전용 — 검색 기간(filters)과 분리 */
  const [calendarMonth, setCalendarMonth] = useState(() => todayYmd());
  const [mapMode, setMapMode] = useState<"single" | "range">("single");
  const [mapDate, setMapDate] = useState<string>(() => todayYmd());
  const [mapFrom, setMapFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [mapTo, setMapTo] = useState<string>(() => todayYmd());

  const [departments, setDepartments] = useState<DepartmentLite[]>([]);
  const [calendarDetailDate, setCalendarDetailDate] = useState<string | null>(null);

  const dateLocale = locale === "en" ? "en-US" : "ko-KR";

  useEffect(() => {
    let aborted = false;
    void (async () => {
      try {
        const r = await fetch("/api/admin/departments");
        if (!r.ok) return;
        const j = await r.json().catch(() => ({}));
        if (aborted) return;
        setDepartments(Array.isArray(j.departments) ? j.departments : []);
      } catch (e) {
        console.error("[attendance load departments]", e);
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  const tabs: { id: AttendanceTab; label: string }[] = [
    { id: "byEmployee", label: t("admin.attendanceTabByEmployee") },
    { id: "holiday", label: t("admin.attendanceTabHoliday") },
    { id: "calendar", label: t("admin.attendanceTabCalendar") },
    { id: "map", label: t("admin.attendanceTabMap") },
    { id: "chart", label: t("admin.attendanceTabChart") },
    { id: "issues", label: t("admin.attendanceTabIssues") },
    { id: "download", label: t("admin.attendanceTabDownload") },
  ];

  const subtitleByTab: Record<AttendanceTab, string> = {
    byEmployee: t("admin.attendanceTabByEmployeeLead"),
    holiday: t("admin.attendanceTabHolidayLead"),
    calendar: t("admin.attendanceTabCalendarLead"),
    map: t("admin.attendanceTabMapLead"),
    chart: t("admin.attendanceTabChartLead"),
    issues: t("admin.attendanceTabIssuesLead"),
    download: t("admin.attendanceTabDownloadLead"),
  };

  /** API 조회에 쓰는 기간 — 달력 탭만 월 범위, 나머지는 검색 filters */
  const fetchFilters = useMemo((): SearchFilters => {
    if (tab === "calendar") {
      const range = monthRangeFromAnchor(calendarMonth);
      return { ...filters, from: range.from, to: range.to };
    }
    return filters;
  }, [tab, filters, calendarMonth]);

  const exportHref = useMemo(() => {
    const q = new URLSearchParams();
    q.set("lang", locale);
    if (filters.status) q.set("status", filters.status);
    if (filters.from) q.set("from", filters.from);
    if (filters.to) q.set("to", filters.to);
    const keyword = filters.q.trim();
    if (keyword) q.set("q", keyword);
    if (filters.departmentId) q.set("departmentId", filters.departmentId);
    return `/api/admin/export?${q.toString()}`;
  }, [filters, locale]);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (fetchFilters.status) q.set("status", fetchFilters.status);
    if (fetchFilters.from) q.set("from", fetchFilters.from);
    if (fetchFilters.to) q.set("to", fetchFilters.to);
    const keyword = fetchFilters.q.trim();
    if (keyword) q.set("q", keyword);
    if (fetchFilters.departmentId) q.set("departmentId", fetchFilters.departmentId);
    const r = await fetch(`/api/admin/attendance?${q.toString()}`);
    const j = await r.json();
    if (r.ok) setRows(j.days ?? []);
    setLoading(false);
  }, [fetchFilters]);

  useEffect(() => {
    if (tab === "download") {
      setLoading(false);
      return;
    }
    void load();
  }, [load, tab]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters({ ...draft, q: draft.q.trim() });
  }

  function resetSearch() {
    const next = defaultFilters();
    setDraft(next);
    setFilters(next);
  }

  function selectTab(id: AttendanceTab) {
    setTab(id);
  }

  const holidayRows = useMemo(() => rows.filter((r) => r.isHolidayWork), [rows]);
  const displayRows = tab === "holiday" ? holidayRows : rows;
  const hasActiveFilters = filtersDifferFromDefault(filters);

  function gotoMonth(delta: number) {
    setCalendarMonth((prev) => shiftCalendarMonth(prev, delta));
  }

  function gotoCalendarToday() {
    setCalendarMonth(todayYmd());
  }

  function applyMonthRangeForDownload() {
    const next = currentMonthRange();
    setDraft({ ...draft, from: next.from, to: next.to });
    setFilters({ ...filters, from: next.from, to: next.to });
  }

  return (
    <div className={pageStack}>
      <PageHeader title={t("admin.attendanceTitle")} subtitle={subtitleByTab[tab]} />

      <div className={`max-w-full overflow-x-auto ${segmentedWrap}`}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectTab(item.id)}
            className={segmentedBtn(tab === item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "map" ? (
        <div className={groupedCard}>
          <div className={tableToolbar}>
            <div className={searchFiltersRow}>
              <div className={`${searchFieldCol} w-full sm:w-auto`}>
                <label className={label}>{t("admin.attendanceMapMode")}</label>
                <div className={segmentedWrap}>
                  <button
                    type="button"
                    className={segmentedBtn(mapMode === "single")}
                    onClick={() => setMapMode("single")}
                  >
                    {t("admin.attendanceMapModeSingle")}
                  </button>
                  <button
                    type="button"
                    className={segmentedBtn(mapMode === "range")}
                    onClick={() => setMapMode("range")}
                  >
                    {t("admin.attendanceMapModeRange")}
                  </button>
                </div>
              </div>
              {mapMode === "single" ? (
                <div className={`${searchFieldCol} w-full sm:w-[10rem]`}>
                  <label className={label} htmlFor="attendance-map-date">
                    {t("admin.attendanceMapDateLabel")}
                  </label>
                  <input
                    id="attendance-map-date"
                    type="date"
                    lang={dateLocale}
                    className={inputCompact}
                    value={mapDate}
                    onChange={(e) => setMapDate(e.target.value)}
                  />
                </div>
              ) : (
                <>
                  <div className={`${searchFieldCol} w-[calc(50%-0.375rem)] sm:w-[8.75rem]`}>
                    <label className={label} htmlFor="attendance-map-from">
                      {t("admin.attendanceDateFrom")}
                    </label>
                    <input
                      id="attendance-map-from"
                      type="date"
                      lang={dateLocale}
                      max={mapTo}
                      className={inputCompact}
                      value={mapFrom}
                      onChange={(e) => setMapFrom(e.target.value)}
                    />
                  </div>
                  <div className={`${searchFieldCol} w-[calc(50%-0.375rem)] sm:w-[8.75rem]`}>
                    <label className={label} htmlFor="attendance-map-to">
                      {t("admin.attendanceDateTo")}
                    </label>
                    <input
                      id="attendance-map-to"
                      type="date"
                      lang={dateLocale}
                      min={mapFrom}
                      className={inputCompact}
                      value={mapTo}
                      onChange={(e) => setMapTo(e.target.value)}
                    />
                  </div>
                </>
              )}
              <div className={searchActions}>
                <button
                  type="button"
                  className={`${btnSecondary} h-9`}
                  onClick={() => {
                    const d = new Date();
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, "0");
                    const day = String(d.getDate()).padStart(2, "0");
                    const today = `${y}-${m}-${day}`;
                    if (mapMode === "single") {
                      setMapDate(today);
                    } else {
                      const start = new Date();
                      start.setDate(start.getDate() - 6);
                      const sy = start.getFullYear();
                      const sm = String(start.getMonth() + 1).padStart(2, "0");
                      const sd = String(start.getDate()).padStart(2, "0");
                      setMapFrom(`${sy}-${sm}-${sd}`);
                      setMapTo(today);
                    }
                  }}
                >
                  {mapMode === "single"
                    ? t("admin.attendanceMapToday")
                    : t("admin.attendanceMapLast7Days")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={groupedCard}>
          <form onSubmit={applySearch} className={tableToolbar}>
            <div className={searchFiltersRow}>
              <div className={`${searchFieldCol} w-full sm:w-auto sm:flex-1 sm:min-w-[14rem] sm:max-w-[18rem]`}>
                <label className={label} htmlFor="attendance-search-name">
                  {t("admin.attendanceSearchName")}
                </label>
                <input
                  id="attendance-search-name"
                  type="search"
                  className={inputCompact}
                  placeholder={t("admin.attendanceSearchNamePlaceholder")}
                  value={draft.q}
                  onChange={(e) => setDraft((prev) => ({ ...prev, q: e.target.value }))}
                />
              </div>
              <div className={`${searchFieldCol} w-[calc(50%-0.375rem)] sm:w-[8.75rem]`}>
                <label className={label} htmlFor="attendance-from">
                  {t("admin.attendanceDateFrom")}
                </label>
                <input
                  id="attendance-from"
                  type="date"
                  lang={dateLocale}
                  className={inputCompact}
                  value={draft.from}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      from: e.target.value,
                      to: e.target.value ? endOfMonthYmd(e.target.value) : prev.to,
                    }))
                  }
                />
              </div>
              <div className={`${searchFieldCol} w-[calc(50%-0.375rem)] sm:w-[8.75rem]`}>
                <label className={label} htmlFor="attendance-to">
                  {t("admin.attendanceDateTo")}
                </label>
                <input
                  id="attendance-to"
                  type="date"
                  lang={dateLocale}
                  className={inputCompact}
                  value={draft.to}
                  onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
                />
              </div>
              <div className={`${searchFieldCol} w-[calc(50%-0.375rem)] sm:w-[9.5rem]`}>
                <label className={label} htmlFor="attendance-department">
                  {t("admin.attendanceFilterDepartment")}
                </label>
                <select
                  id="attendance-department"
                  className={`${selectSm} !w-full !min-w-0`}
                  value={draft.departmentId}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, departmentId: e.target.value }))
                  }
                >
                  <option value="">{t("admin.attendanceFilterDepartmentAll")}</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`${searchActions} !flex-nowrap whitespace-nowrap`}>
                <button type="submit" className={`${btnPrimary} h-9 px-4`}>
                  {t("admin.attendanceSearchApply")}
                </button>
                <button
                  type="button"
                  className={`${btnSecondary} h-9`}
                  onClick={() => setDraft((prev) => ({ ...prev, to: todayYmd() }))}
                >
                  {t("admin.attendanceMapToday")}
                </button>
                {hasActiveFilters && (
                  <button type="button" onClick={resetSearch} className={`${btnSecondary} h-9`}>
                    {t("admin.attendanceSearchReset")}
                  </button>
                )}
                {tab !== "download" && (
                  <a href={exportHref} className={`${btnSecondary} h-9`}>
                    Excel
                  </a>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      {tab === "map" ? (
        mapMode === "single" ? (
          <AdminDayAttendanceMap date={mapDate} />
        ) : (
          <AdminDayAttendanceMap from={mapFrom} to={mapTo} />
        )
      ) : loading ? (
        <p className="text-[1rem] text-[var(--apple-label-secondary)]">{t("common.loading")}</p>
      ) : tab === "calendar" ? (
        <AttendanceCalendarView
          rows={rows}
          month={calendarMonth}
          dateLocale={dateLocale}
          onPrevMonth={() => gotoMonth(-1)}
          onNextMonth={() => gotoMonth(1)}
          onToday={gotoCalendarToday}
          onPickDay={(d) => setCalendarDetailDate(d)}
        />
      ) : tab === "chart" ? (
        rows.length === 0 ? (
          <p className={emptyState}>{t("admin.attendanceEmpty")}</p>
        ) : (
          <AttendanceChartView
            rows={rows}
            fromDate={filters.from || todayYmd()}
            toDate={filters.to || todayYmd()}
            dateLocale={dateLocale}
          />
        )
      ) : tab === "issues" ? (
        <AttendanceIssuesView
          from={filters.from || todayYmd()}
          to={filters.to || todayYmd()}
          departmentId={filters.departmentId || null}
          query={filters.q}
        />
      ) : tab === "download" ? (
        <AttendanceDownloadView
          exportHref={exportHref}
          filters={filters}
          departments={departments}
          onApplyMonthRange={applyMonthRangeForDownload}
        />
      ) : displayRows.length === 0 ? (
        <p className={emptyState}>{t("admin.attendanceEmpty")}</p>
      ) : tab === "byEmployee" ? (
        <AttendanceByEmployeeView rows={displayRows} dateLocale={dateLocale} />
      ) : (
        <AttendanceDayTable rows={displayRows} dateLocale={dateLocale} />
      )}

      <CalendarDayDetailModal
        open={calendarDetailDate !== null}
        onClose={() => setCalendarDetailDate(null)}
        date={calendarDetailDate}
        rows={rows}
        dateLocale={dateLocale}
      />
    </div>
  );
}
