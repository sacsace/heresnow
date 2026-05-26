"use client";

import { useI18n } from "@/components/LanguageProvider";
import { formatDurationMinutes } from "@/components/admin/attendance/helpers";
import { emptyState, table, tableHead, tableWrap, td, th, trDivider } from "@/lib/uiStyles";
import { useEffect, useMemo, useState } from "react";

type IssueRow = {
  employeeId: string;
  employeeName: string;
  departmentId: string | null;
  departmentName: string | null;
  lateDays: number;
  earlyLeaveDays: number;
  absentDays: number;
  incompleteDays: number;
  lateMinutesTotal: number;
  attendanceDays: number;
  workdays: number;
  score: number;
  isUnderPerformer: boolean;
};

type IssuesResponse = {
  timezone: string;
  from: string;
  to: string;
  totalWorkdays: number;
  workDays: number[];
  thresholdRank: number;
  percentile: number;
  issues: IssueRow[];
};

type Props = {
  from: string;
  to: string;
  departmentId: string | null;
  query: string;
};

type SortKey =
  | "name"
  | "department"
  | "absent"
  | "late"
  | "early"
  | "incomplete"
  | "lateMin"
  | "score";

type SortDir = "asc" | "desc";

export function AttendanceIssuesView({ from, to, departmentId, query }: Props) {
  const { t } = useI18n();
  const [data, setData] = useState<IssuesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyUnderPerformers, setOnlyUnderPerformers] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    let aborted = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams();
        q.set("from", from);
        q.set("to", to);
        if (departmentId) q.set("departmentId", departmentId);
        const r = await fetch(`/api/admin/attendance/issues?${q.toString()}`);
        const j = await r.json().catch(() => null);
        if (aborted) return;
        if (!r.ok) {
          setError(j?.error ?? t("admin.attendanceLoadFail"));
          setData(null);
        } else {
          setData(j as IssuesResponse);
        }
      } catch (e) {
        if (aborted) return;
        console.error("[issues load]", e);
        setError(t("admin.attendanceLoadFail"));
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, departmentId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    let arr = data.issues;
    if (onlyUnderPerformers) {
      arr = arr.filter((r) => r.isUnderPerformer);
    } else {
      arr = arr.filter((r) => r.score > 0);
    }
    if (q) arr = arr.filter((r) => r.employeeName.toLowerCase().includes(q));
    return [...arr].sort((a, b) => {
      const cmp = compareIssue(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, onlyUnderPerformers, query, sortKey, sortDir]);

  function toggleSort(next: SortKey) {
    if (next === sortKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(next);
      const defaultDesc: SortKey[] = ["absent", "late", "early", "incomplete", "lateMin", "score"];
      setSortDir(defaultDesc.includes(next) ? "desc" : "asc");
    }
  }

  if (loading) {
    return (
      <p className="text-[1rem] text-[var(--apple-label-secondary)]">{t("common.loading")}</p>
    );
  }

  if (error) {
    return <p className={emptyState}>{error}</p>;
  }

  if (!data || data.issues.length === 0) {
    return <p className={emptyState}>{t("admin.attendanceEmpty")}</p>;
  }

  const arrow = (key: SortKey) => {
    if (sortKey !== key) {
      return (
        <span aria-hidden="true" className="ml-1 text-[var(--apple-label-tertiary)] opacity-50">
          ↕
        </span>
      );
    }
    return (
      <span aria-hidden="true" className="ml-1 text-[var(--apple-blue)]">
        {sortDir === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  const sortableTh = (key: SortKey, label: string, extra = "") => (
    <th
      className={`${th} ${extra}`}
      aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="inline-flex items-center text-inherit hover:text-[var(--foreground)] cursor-pointer select-none"
      >
        {label}
        {arrow(key)}
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="space-y-1">
          <p className="text-[0.875rem] font-medium text-[var(--foreground)]">
            {t("admin.attendanceIssuesSummary")
              .replace("{from}", data.from)
              .replace("{to}", data.to)
              .replace("{workdays}", String(data.totalWorkdays))}
          </p>
          <p className="text-[0.8125rem] text-[var(--apple-label-secondary)]">
            {t("admin.attendanceIssuesThreshold")
              .replace("{rank}", String(data.thresholdRank))
              .replace("{percentile}", String(data.percentile))}
          </p>
        </div>
        <label className="flex cursor-pointer select-none items-center gap-2 text-[0.875rem] text-[var(--foreground)]">
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer accent-[var(--apple-blue)]"
            checked={onlyUnderPerformers}
            onChange={(e) => setOnlyUnderPerformers(e.target.checked)}
          />
          {t("admin.attendanceIssuesOnlyUnder")}
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className={emptyState}>{t("admin.attendanceIssuesNone")}</p>
      ) : (
        <div className={tableWrap}>
          <table className={table}>
            <thead className={tableHead}>
              <tr>
                {sortableTh("name", t("admin.attendanceColEmployee"))}
                {sortableTh("department", t("admin.attendanceFilterDepartment"))}
                {sortableTh("absent", t("admin.attendanceIssuesColAbsent"))}
                {sortableTh("late", t("admin.attendanceIssuesColLate"))}
                {sortableTh("early", t("admin.attendanceIssuesColEarly"))}
                {sortableTh("incomplete", t("admin.attendanceIssuesColIncomplete"))}
                {sortableTh("lateMin", t("admin.attendanceIssuesColLateMin"))}
                {sortableTh("score", t("admin.attendanceIssuesColScore"))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.employeeId} className={trDivider}>
                  <td className={`${td} font-semibold`}>
                    <span className="inline-flex items-center gap-2">
                      {r.employeeName}
                      {r.isUnderPerformer && (
                        <span
                          className="rounded-full bg-[var(--apple-red)]/10 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] text-[var(--apple-red)]"
                          title={t("admin.attendanceIssuesUnderTooltip")}
                        >
                          {t("admin.attendanceIssuesUnderBadge")}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className={`${td} text-[0.875rem] text-[var(--apple-label-secondary)]`}>
                    {r.departmentName ?? "—"}
                  </td>
                  <td className={`${td} tabular-nums text-[0.9375rem]`}>
                    {r.absentDays > 0 ? (
                      <span className="font-semibold text-[var(--apple-red)]">{r.absentDays}</span>
                    ) : (
                      <span className="text-[var(--apple-label-tertiary)]">0</span>
                    )}
                  </td>
                  <td className={`${td} tabular-nums text-[0.9375rem]`}>
                    {r.lateDays > 0 ? (
                      <span className="font-semibold text-[var(--apple-orange-dark)]">
                        {r.lateDays}
                      </span>
                    ) : (
                      <span className="text-[var(--apple-label-tertiary)]">0</span>
                    )}
                  </td>
                  <td className={`${td} tabular-nums text-[0.9375rem]`}>
                    {r.earlyLeaveDays > 0 ? (
                      <span className="font-semibold text-[var(--apple-orange-dark)]">
                        {r.earlyLeaveDays}
                      </span>
                    ) : (
                      <span className="text-[var(--apple-label-tertiary)]">0</span>
                    )}
                  </td>
                  <td className={`${td} tabular-nums text-[0.9375rem]`}>
                    {r.incompleteDays > 0 ? (
                      <span className="font-semibold text-[var(--apple-orange-dark)]">
                        {r.incompleteDays}
                      </span>
                    ) : (
                      <span className="text-[var(--apple-label-tertiary)]">0</span>
                    )}
                  </td>
                  <td className={`${td} tabular-nums text-[0.875rem] text-[var(--apple-label-secondary)]`}>
                    {r.lateMinutesTotal > 0
                      ? formatDurationMinutes(r.lateMinutesTotal, t)
                      : "—"}
                  </td>
                  <td className={`${td} tabular-nums text-[0.9375rem] font-semibold`}>
                    {r.score > 0 ? (
                      <span className="text-[var(--apple-red)]">{r.score}</span>
                    ) : (
                      <span className="text-[var(--apple-label-tertiary)]">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function compareIssue(a: IssueRow, b: IssueRow, key: SortKey): number {
  switch (key) {
    case "name":
      return a.employeeName.localeCompare(b.employeeName, "ko");
    case "department":
      return (a.departmentName ?? "").localeCompare(b.departmentName ?? "", "ko");
    case "absent":
      return a.absentDays - b.absentDays;
    case "late":
      return a.lateDays - b.lateDays;
    case "early":
      return a.earlyLeaveDays - b.earlyLeaveDays;
    case "incomplete":
      return a.incompleteDays - b.incompleteDays;
    case "lateMin":
      return a.lateMinutesTotal - b.lateMinutesTotal;
    case "score":
      return a.score - b.score;
    default:
      return 0;
  }
}
