"use client";

import { AttendanceChartView } from "@/components/admin/attendance/ChartView";
import { useI18n } from "@/components/LanguageProvider";
import type { AdminAttendanceDayRow } from "@/lib/adminAttendanceByDay";
import { emptyState, inputCompact, label, pageSubtitle, sectionLabel } from "@/lib/uiStyles";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  companyId: string;
};

function defaultRange(): { from: string; to: string } {
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

export function SuperCompanyAttendanceStats({ companyId }: Props) {
  const { t, locale } = useI18n();
  const dateLocale = locale === "en" ? "en-US" : "ko-KR";
  const [range, setRange] = useState(() => defaultRange());
  const [draft, setDraft] = useState(() => defaultRange());
  const [rows, setRows] = useState<AdminAttendanceDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 빠른 연속 요청 시 늦게 도착한 이전 응답이 최신 결과를 덮어쓰지 않도록 토큰 가드.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    const q = new URLSearchParams();
    q.set("companyId", companyId);
    if (range.from) q.set("from", range.from);
    if (range.to) q.set("to", range.to);
    q.set("limit", "500");
    let r: Response;
    try {
      r = await fetch(`/api/admin/attendance?${q.toString()}`);
    } catch {
      if (reqId !== requestIdRef.current) return;
      setLoading(false);
      setRows([]);
      setError(t("admin.attendanceLoadFail"));
      return;
    }
    const j = await r.json().catch(() => ({}));
    if (reqId !== requestIdRef.current) return;
    setLoading(false);
    if (!r.ok) {
      setRows([]);
      setError(typeof j.error === "string" ? j.error : t("admin.attendanceLoadFail"));
      return;
    }
    setRows((j.days ?? []) as AdminAttendanceDayRow[]);
  }, [companyId, range, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyRange(e: React.FormEvent) {
    e.preventDefault();
    setRange({ ...draft });
  }

  return (
    <section className="space-y-4">
      <div className="px-1">
        <p className={sectionLabel}>{t("super.statsTitle")}</p>
        <p className={pageSubtitle}>{t("super.statsLead")}</p>
      </div>

      <form
        onSubmit={applyRange}
        className="flex flex-wrap items-end gap-3 rounded-2xl bg-[var(--grouped-bg)] p-4 ring-1 ring-black/[0.05] sm:p-5"
      >
        <div className="min-w-0">
          <label className={label} htmlFor="super-stats-from">
            {t("admin.attendanceDateFrom")}
          </label>
          <input
            id="super-stats-from"
            type="date"
            lang={dateLocale}
            className={`${inputCompact} mt-1.5 sm:min-w-[10rem]`}
            value={draft.from}
            onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value }))}
          />
        </div>
        <div className="min-w-0">
          <label className={label} htmlFor="super-stats-to">
            {t("admin.attendanceDateTo")}
          </label>
          <input
            id="super-stats-to"
            type="date"
            lang={dateLocale}
            className={`${inputCompact} mt-1.5 sm:min-w-[10rem]`}
            value={draft.to}
            onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-9 min-h-[2.25rem] touch-manipulation items-center justify-center rounded-[0.625rem] bg-[var(--apple-blue)] px-4 text-[0.875rem] font-semibold text-white transition-colors hover:bg-[#0071e3] active:bg-[#0066cc] disabled:opacity-40"
        >
          {t("admin.attendanceSearchApply")}
        </button>
      </form>

      {loading && <p className="px-1 text-[0.9375rem] text-[var(--apple-label-secondary)]">{t("common.loading")}</p>}
      {!loading && error && <p className="px-1 text-sm text-[var(--apple-red)]">{error}</p>}
      {!loading && !error && rows.length === 0 && (
        <p className={emptyState}>{t("admin.attendanceEmpty")}</p>
      )}
      {!loading && !error && rows.length > 0 && <AttendanceChartView rows={rows} />}
    </section>
  );
}
