"use client";

import { AttendanceByEmployeeView } from "@/components/admin/attendance/ByEmployeeView";
import { useI18n } from "@/components/LanguageProvider";
import type { AdminAttendanceDayRow } from "@/lib/adminAttendanceByDay";
import { emptyState, errorText, inputCompact, label, sectionLabelCompact } from "@/lib/uiStyles";
import { useSession } from "next-auth/react";
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

export function SuperCompanyEmployeeAttendance({ companyId }: Props) {
  const { t, locale } = useI18n();
  const dateLocale = locale === "en" ? "en-US" : "ko-KR";
  const { data: session } = useSession();
  const isRoot =
    session?.user?.role === "SUPER_ADMIN" &&
    (session.user.email ?? "").trim().toLowerCase() === "root";

  const [range, setRange] = useState(() => defaultRange());
  const [draft, setDraft] = useState(() => defaultRange());
  const [qDraft, setQDraft] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminAttendanceDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingDayId, setDeletingDayId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("companyId", companyId);
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    if (q.trim()) params.set("q", q.trim());
    params.set("limit", "500");

    let r: Response;
    try {
      r = await fetch(`/api/admin/attendance?${params.toString()}`);
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
  }, [companyId, q, range.from, range.to, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setRange({ ...draft });
    setQ(qDraft.trim());
  }

  async function deleteDay(row: AdminAttendanceDayRow) {
    if (!isRoot) return;
    const checkInId = row.checkIn?.id;
    const checkOutId = row.checkOut?.id;
    if (!checkInId && !checkOutId) return;

    const confirmText = t("super.attendanceDeleteConfirm")
      .replace("{name}", row.employeeName)
      .replace("{date}", row.date);
    if (typeof window !== "undefined" && !window.confirm(confirmText)) return;

    setDeleteError(null);
    setDeletingDayId(row.id);
    const r = await fetch(`/api/super/companies/${companyId}/attendance/day`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: row.employeeId,
        checkInId,
        checkOutId,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setDeletingDayId(null);
    if (!r.ok) {
      setDeleteError(typeof j.error === "string" ? j.error : t("super.attendanceDeleteFail"));
      return;
    }
    setRows((prev) => prev.filter((item) => item.id !== row.id));
  }

  return (
    <section className="space-y-3">
      <div>
        <p className={sectionLabelCompact}>{t("super.tabByEmployee")}</p>
        <p className="mt-0.5 max-w-3xl text-[0.75rem] leading-snug text-[var(--apple-label-secondary)] sm:text-[0.8125rem]">
          {t("super.byEmployeeLead")}
        </p>
      </div>

      <form
        onSubmit={applyFilters}
        className="flex flex-wrap items-end gap-2 rounded-xl bg-[var(--grouped-bg)] p-3 ring-1 ring-black/[0.05] sm:gap-3 sm:p-3.5"
      >
        <div className="min-w-0 flex-1 sm:max-w-[12rem]">
          <label className={`${label} !text-[0.75rem]`} htmlFor="super-byemp-q">
            {t("admin.attendanceSearchName")}
          </label>
          <input
            id="super-byemp-q"
            type="search"
            className={`${inputCompact} mt-1 w-full`}
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder={t("admin.attendanceSearchNamePlaceholder")}
          />
        </div>
        <div className="min-w-0">
          <label className={`${label} !text-[0.75rem]`} htmlFor="super-byemp-from">
            {t("admin.attendanceDateFrom")}
          </label>
          <input
            id="super-byemp-from"
            type="date"
            lang={dateLocale}
            className={`${inputCompact} mt-1 sm:min-w-[9.5rem]`}
            value={draft.from}
            onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value }))}
          />
        </div>
        <div className="min-w-0">
          <label className={`${label} !text-[0.75rem]`} htmlFor="super-byemp-to">
            {t("admin.attendanceDateTo")}
          </label>
          <input
            id="super-byemp-to"
            type="date"
            lang={dateLocale}
            className={`${inputCompact} mt-1 sm:min-w-[9.5rem]`}
            value={draft.to}
            onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-8 min-h-[2rem] touch-manipulation items-center justify-center rounded-[0.625rem] bg-[var(--apple-blue)] px-3.5 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-[#0071e3] active:bg-[#0066cc] disabled:opacity-40"
        >
          {t("admin.attendanceSearchApply")}
        </button>
      </form>

      {isRoot ? (
        <p className="px-1 text-[0.75rem] text-[var(--apple-label-secondary)]">
          {t("super.attendanceDeleteHint")}
        </p>
      ) : null}

      {loading && (
        <p className="text-[0.8125rem] text-[var(--apple-label-secondary)]">{t("common.loading")}</p>
      )}
      {!loading && error && <p className={`px-1 text-sm ${errorText}`}>{error}</p>}
      {deleteError && <p className={`px-1 text-sm ${errorText}`}>{deleteError}</p>}
      {!loading && !error && rows.length === 0 && (
        <p className={emptyState}>{t("admin.attendanceEmpty")}</p>
      )}
      {!loading && !error && rows.length > 0 && (
        <AttendanceByEmployeeView
          rows={rows}
          dateLocale={dateLocale}
          showDelete={isRoot}
          deletingDayId={deletingDayId}
          onDeleteDay={(row) => void deleteDay(row)}
        />
      )}
    </section>
  );
}
